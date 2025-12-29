import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Copy, Check, Download, FileText, Code, Search, ChevronUp, ChevronDown, X, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore, type HttpResponse } from "@/stores/appStore";
import {
  detectContentType,
  formatResponseBody,
  type ContentType,
} from "@/lib/response-formatter";
import { isTauriAvailable, saveResponseToFile } from "@/lib/tauri";

interface SearchState {
  query: string;
  isRegex: boolean;
  caseSensitive: boolean;
  currentMatch: number;
  totalMatches: number;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

interface ResponsePanelProps {
  response: HttpResponse;
}

type TabType = "body" | "headers" | "raw";

export function ResponsePanel({ response }: ResponsePanelProps) {
  const { workspacePath, openHistoryForCompare } = useAppStore();
  const [activeTab, setActiveTab] = useState<TabType>("body");
  const [copied, setCopied] = useState(false);
  const [showFormatted, setShowFormatted] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState<SearchState>({
    query: "",
    isRegex: false,
    caseSensitive: false,
    currentMatch: 0,
    totalMatches: 0,
  });
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  // Detect content type
  const contentType = useMemo(
    () => detectContentType(response.headers, response.body),
    [response.headers, response.body]
  );

  // Format body based on content type
  const formattedBody = useMemo(
    () => (showFormatted ? formatResponseBody(response.body, contentType) : response.body),
    [response.body, contentType, showFormatted]
  );

  // Calculate matches when search query changes
  const matches = useMemo(() => {
    if (!search.query) return [];

    try {
      const flags = search.caseSensitive ? "g" : "gi";
      const pattern = search.isRegex
        ? new RegExp(search.query, flags)
        : new RegExp(escapeRegex(search.query), flags);

      const results: number[] = [];
      let match;
      while ((match = pattern.exec(formattedBody)) !== null) {
        results.push(match.index);
      }
      return results;
    } catch {
      return [];
    }
  }, [search.query, search.isRegex, search.caseSensitive, formattedBody]);

  // Update total matches count
  useEffect(() => {
    setSearch((s) => ({
      ...s,
      totalMatches: matches.length,
      currentMatch: matches.length > 0 ? Math.min(s.currentMatch, matches.length - 1) : 0,
    }));
  }, [matches.length]);

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setShowSearch(true);
      }
      if (e.key === "Escape" && showSearch) {
        setShowSearch(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showSearch]);

  const goToNextMatch = useCallback(() => {
    if (matches.length === 0) return;
    setSearch((s) => ({
      ...s,
      currentMatch: (s.currentMatch + 1) % matches.length,
    }));
  }, [matches.length]);

  const goToPrevMatch = useCallback(() => {
    if (matches.length === 0) return;
    setSearch((s) => ({
      ...s,
      currentMatch: (s.currentMatch - 1 + matches.length) % matches.length,
    }));
  }, [matches.length]);

  // Auto-scroll to current match
  useEffect(() => {
    if (matches.length === 0) return;
    const currentElement = document.querySelector('[data-current="true"]');
    if (currentElement) {
      currentElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [search.currentMatch, matches.length]);

  const handleCopy = async () => {
    const content =
      activeTab === "body"
        ? response.body
        : activeTab === "headers"
        ? JSON.stringify(response.headers, null, 2)
        : response.body;

    await navigator.clipboard.writeText(content);
    setCopied(true);
    // Clear any existing timeout before setting a new one
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
    }
    copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = useCallback(async () => {
    const content = response.body;
    const responseContentType = response.headers["content-type"] || response.headers["Content-Type"] || "text/plain";

    // Use native save dialog in Tauri
    if (isTauriAvailable()) {
      try {
        const savedPath = await saveResponseToFile(content, responseContentType);
        if (savedPath) {
          console.log("Response saved to:", savedPath);
        }
      } catch (error) {
        console.error("Failed to save response:", error);
        // Fall back to blob download on error
        downloadAsBlob(content, responseContentType);
      }
    } else {
      // Fallback for non-Tauri (browser) environment
      downloadAsBlob(content, responseContentType);
    }
  }, [response.body, response.headers]);

  const downloadAsBlob = (content: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType || "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const ext = mimeType.includes("json") ? "json" : mimeType.includes("xml") ? "xml" : "txt";
    a.download = `response-${Date.now()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Keyboard shortcut for save response (Ctrl+Shift+S)
  useEffect(() => {
    const handleSaveShortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "s") {
        e.preventDefault();
        handleDownload();
      }
    };
    window.addEventListener("keydown", handleSaveShortcut);
    return () => window.removeEventListener("keydown", handleSaveShortcut);
  }, [handleDownload]);

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return "text-green-500";
    if (status >= 300 && status < 400) return "text-yellow-500";
    if (status >= 400 && status < 500) return "text-orange-500";
    return "text-red-500";
  };

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-4">
          {/* Status */}
          <div className="flex items-center gap-2">
            <span className={cn("font-mono font-bold", getStatusColor(response.status))}>
              {response.status}
            </span>
            <span className="text-sm text-muted-foreground">
              {response.statusText}
            </span>
          </div>

          {/* Timing and Size */}
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{response.time}ms</span>
            <span>{formatBytes(response.size)}</span>
          </div>

          {/* Content Type Badge */}
          <span className={cn(
            "px-2 py-0.5 rounded text-xs font-medium uppercase",
            contentType === "json" && "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400",
            contentType === "xml" && "bg-orange-500/20 text-orange-600 dark:text-orange-400",
            contentType === "html" && "bg-blue-500/20 text-blue-600 dark:text-blue-400",
            contentType === "text" && "bg-gray-500/20 text-gray-600 dark:text-gray-400",
            contentType === "binary" && "bg-purple-500/20 text-purple-600 dark:text-purple-400"
          )}>
            {contentType}
          </span>

          {/* Tabs */}
          <div className="flex items-center border rounded-md overflow-hidden">
            {(["body", "headers", "raw"] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-3 py-1 text-sm capitalize transition-colors",
                  activeTab === tab
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent"
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Format Toggle */}
          {activeTab === "body" && contentType !== "binary" && contentType !== "text" && (
            <button
              onClick={() => setShowFormatted(!showFormatted)}
              className={cn(
                "flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors",
                showFormatted ? "bg-accent" : "bg-muted hover:bg-accent"
              )}
              title={showFormatted ? "Show raw" : "Show formatted"}
            >
              {showFormatted ? (
                <>
                  <Code className="h-3 w-3" />
                  <span>Formatted</span>
                </>
              ) : (
                <>
                  <FileText className="h-3 w-3" />
                  <span>Raw</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {workspacePath && (
            <button
              onClick={openHistoryForCompare}
              className="flex items-center gap-1 px-2 py-1 text-xs border border-input rounded hover:bg-accent transition-colors"
              title="Compare with previous response"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              Compare
            </button>
          )}
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={cn(
              "p-1.5 rounded hover:bg-accent transition-colors",
              showSearch && "bg-accent"
            )}
            title="Search (Ctrl+F)"
          >
            <Search className="h-4 w-4" />
          </button>
          <button
            onClick={handleCopy}
            className="p-1.5 rounded hover:bg-accent transition-colors"
            title="Copy to clipboard"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={handleDownload}
            className="p-1.5 rounded hover:bg-accent transition-colors"
            title="Save response (Ctrl+Shift+S)"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/50">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search.query}
            onChange={(e) => setSearch((s) => ({ ...s, query: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (e.shiftKey) {
                  goToPrevMatch();
                } else {
                  goToNextMatch();
                }
              }
            }}
            placeholder="Search in response..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            autoFocus
          />
          <button
            onClick={() => setSearch((s) => ({ ...s, isRegex: !s.isRegex }))}
            className={cn(
              "px-1.5 py-0.5 text-xs rounded font-mono",
              search.isRegex ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent"
            )}
            title="Use regular expression"
          >
            .*
          </button>
          <button
            onClick={() => setSearch((s) => ({ ...s, caseSensitive: !s.caseSensitive }))}
            className={cn(
              "px-1.5 py-0.5 text-xs rounded font-mono",
              search.caseSensitive ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent"
            )}
            title="Match case"
          >
            Aa
          </button>
          {search.query && (
            <span className="text-xs text-muted-foreground">
              {matches.length > 0
                ? `${search.currentMatch + 1} of ${matches.length}`
                : "No results"}
            </span>
          )}
          <button
            onClick={goToPrevMatch}
            disabled={matches.length === 0}
            className="p-1 rounded hover:bg-accent disabled:opacity-50"
            title="Previous match"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            onClick={goToNextMatch}
            disabled={matches.length === 0}
            className="p-1 rounded hover:bg-accent disabled:opacity-50"
            title="Next match"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              setShowSearch(false);
              setSearch((s) => ({ ...s, query: "" }));
            }}
            className="p-1 rounded hover:bg-accent"
            title="Close search"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-3">
        {activeTab === "body" && (
          <ResponseBody
            body={formattedBody}
            contentType={contentType}
            searchQuery={search.query}
            searchRegex={search.isRegex}
            caseSensitive={search.caseSensitive}
            currentMatch={search.currentMatch}
            matches={matches}
          />
        )}
        {activeTab === "headers" && <ResponseHeaders headers={response.headers} />}
        {activeTab === "raw" && (
          <ResponseRaw
            body={response.body}
            searchQuery={search.query}
            searchRegex={search.isRegex}
            caseSensitive={search.caseSensitive}
            currentMatch={search.currentMatch}
            matches={matches}
          />
        )}
      </div>
    </div>
  );
}

interface SearchHighlightProps {
  text: string;
  searchQuery: string;
  searchRegex: boolean;
  caseSensitive: boolean;
  currentMatch: number;
  matches: number[];
}

function HighlightedText({
  text,
  searchQuery,
  searchRegex,
  caseSensitive,
  currentMatch,
  matches,
}: SearchHighlightProps) {
  if (!searchQuery || matches.length === 0) {
    return <>{text}</>;
  }

  try {
    const flags = caseSensitive ? "g" : "gi";
    const pattern = searchRegex
      ? new RegExp(searchQuery, flags)
      : new RegExp(escapeRegex(searchQuery), flags);

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let matchIndex = 0;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }

      // Add highlighted match
      const isCurrentMatch = matchIndex === currentMatch;
      parts.push(
        <mark
          key={match.index}
          className={cn(
            "rounded px-0.5",
            isCurrentMatch
              ? "bg-yellow-400 dark:bg-yellow-500 text-black"
              : "bg-yellow-200 dark:bg-yellow-700/50"
          )}
          data-current={isCurrentMatch}
        >
          {match[0]}
        </mark>
      );

      lastIndex = match.index + match[0].length;
      matchIndex++;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return <>{parts}</>;
  } catch {
    return <>{text}</>;
  }
}

interface ResponseBodyProps {
  body: string;
  contentType: ContentType;
  searchQuery: string;
  searchRegex: boolean;
  caseSensitive: boolean;
  currentMatch: number;
  matches: number[];
}

function ResponseBody({
  body,
  contentType,
  searchQuery,
  searchRegex,
  caseSensitive,
  currentMatch,
  matches,
}: ResponseBodyProps) {
  // Handle binary content
  if (contentType === "binary") {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <FileText className="h-12 w-12 mb-2 opacity-50" />
        <p className="text-sm">Binary content</p>
        <p className="text-xs opacity-70">({body.length} bytes)</p>
      </div>
    );
  }

  // If searching, show plain text with highlights instead of syntax highlighting
  if (searchQuery && matches.length > 0) {
    return (
      <pre className="text-sm font-mono whitespace-pre-wrap">
        <HighlightedText
          text={body}
          searchQuery={searchQuery}
          searchRegex={searchRegex}
          caseSensitive={caseSensitive}
          currentMatch={currentMatch}
          matches={matches}
        />
      </pre>
    );
  }

  // Handle JSON with syntax highlighting
  if (contentType === "json") {
    try {
      const parsed = JSON.parse(body);
      return (
        <pre className="text-sm font-mono whitespace-pre-wrap">
          <JsonHighlight json={parsed} />
        </pre>
      );
    } catch {
      // Fall through to plain text if parse fails
    }
  }

  // Handle XML/HTML with basic highlighting
  if (contentType === "xml" || contentType === "html") {
    return (
      <pre className="text-sm font-mono whitespace-pre-wrap">
        <XmlHighlight content={body} />
      </pre>
    );
  }

  // Plain text
  return (
    <pre className="text-sm font-mono whitespace-pre-wrap">{body}</pre>
  );
}

function ResponseHeaders({ headers }: { headers: Record<string, string> }) {
  return (
    <div className="space-y-1">
      {Object.entries(headers).map(([key, value]) => (
        <div key={key} className="flex gap-2 text-sm font-mono">
          <span className="text-muted-foreground">{key}:</span>
          <span>{value}</span>
        </div>
      ))}
    </div>
  );
}

interface ResponseRawProps {
  body: string;
  searchQuery: string;
  searchRegex: boolean;
  caseSensitive: boolean;
  currentMatch: number;
  matches: number[];
}

function ResponseRaw({
  body,
  searchQuery,
  searchRegex,
  caseSensitive,
  currentMatch,
  matches,
}: ResponseRawProps) {
  return (
    <pre className="text-sm font-mono whitespace-pre-wrap text-muted-foreground">
      {searchQuery && matches.length > 0 ? (
        <HighlightedText
          text={body}
          searchQuery={searchQuery}
          searchRegex={searchRegex}
          caseSensitive={caseSensitive}
          currentMatch={currentMatch}
          matches={matches}
        />
      ) : (
        body
      )}
    </pre>
  );
}

// Simple JSON syntax highlighting component
function JsonHighlight({ json, depth = 0 }: { json: unknown; depth?: number }) {
  const indent = "  ".repeat(depth);

  if (json === null) {
    return <span className="text-orange-500">null</span>;
  }

  if (typeof json === "boolean") {
    return <span className="text-orange-500">{json.toString()}</span>;
  }

  if (typeof json === "number") {
    return <span className="text-green-500">{json}</span>;
  }

  if (typeof json === "string") {
    return <span className="text-yellow-600 dark:text-yellow-400">"{json}"</span>;
  }

  if (Array.isArray(json)) {
    if (json.length === 0) return <span>[]</span>;
    return (
      <>
        {"[\n"}
        {json.map((item, i) => (
          <span key={i}>
            {indent}  <JsonHighlight json={item} depth={depth + 1} />
            {i < json.length - 1 ? "," : ""}
            {"\n"}
          </span>
        ))}
        {indent}]
      </>
    );
  }

  if (typeof json === "object") {
    const entries = Object.entries(json);
    if (entries.length === 0) return <span>{"{}"}</span>;
    return (
      <>
        {"{\n"}
        {entries.map(([key, value], i) => (
          <span key={key}>
            {indent}  <span className="text-blue-500 dark:text-blue-400">"{key}"</span>:{" "}
            <JsonHighlight json={value} depth={depth + 1} />
            {i < entries.length - 1 ? "," : ""}
            {"\n"}
          </span>
        ))}
        {indent}
        {"}"}
      </>
    );
  }

  return <span>{String(json)}</span>;
}

// Simple XML/HTML syntax highlighting component
function XmlHighlight({ content }: { content: string }) {
  // Split content into parts: tags, attributes, text
  const parts: React.ReactNode[] = [];
  let remaining = content;
  let key = 0;

  const tagRegex = /<\/?[\w:-]+(?:\s+[^>]*)?\/?>/g;
  let lastIndex = 0;
  let match;

  while ((match = tagRegex.exec(remaining)) !== null) {
    // Add text before the tag
    if (match.index > lastIndex) {
      const text = remaining.slice(lastIndex, match.index);
      if (text.trim()) {
        parts.push(<span key={key++}>{text}</span>);
      } else {
        parts.push(text);
      }
    }

    // Highlight the tag
    const tag = match[0];
    parts.push(<XmlTag key={key++} tag={tag} />);

    lastIndex = match.index + tag.length;
  }

  // Add remaining text
  if (lastIndex < remaining.length) {
    parts.push(<span key={key++}>{remaining.slice(lastIndex)}</span>);
  }

  return <>{parts}</>;
}

function XmlTag({ tag }: { tag: string }) {
  // Parse the tag into components
  const isClosing = tag.startsWith("</");
  const isSelfClosing = tag.endsWith("/>");
  const isDeclaration = tag.startsWith("<?") || tag.startsWith("<!");

  // Extract tag name and attributes
  const match = tag.match(/<\/?([:\w-]+)(.*?)\/?>/s);
  if (!match) {
    return <span className="text-muted-foreground">{tag}</span>;
  }

  const [, tagName, attrsString] = match;

  // Parse attributes
  const attrRegex = /([:\w-]+)(?:=(?:"([^"]*)"|'([^']*)'))?/g;
  const attrs: React.ReactNode[] = [];
  let attrMatch;
  let attrKey = 0;

  while ((attrMatch = attrRegex.exec(attrsString)) !== null) {
    const [, attrName, value1, value2] = attrMatch;
    const value = value1 ?? value2;

    if (attrName) {
      attrs.push(
        <span key={attrKey++}>
          {" "}
          <span className="text-yellow-600 dark:text-yellow-400">{attrName}</span>
          {value !== undefined && (
            <>
              =<span className="text-green-600 dark:text-green-400">"{value}"</span>
            </>
          )}
        </span>
      );
    }
  }

  return (
    <span className={isDeclaration ? "text-muted-foreground" : ""}>
      <span className="text-muted-foreground">&lt;</span>
      {isClosing && <span className="text-muted-foreground">/</span>}
      <span className="text-blue-500 dark:text-blue-400">{tagName}</span>
      {attrs}
      {isSelfClosing && <span className="text-muted-foreground">/</span>}
      <span className="text-muted-foreground">&gt;</span>
    </span>
  );
}
