import { useMemo } from "react";
import { DiffEditor, BeforeMount } from "@monaco-editor/react";
import { X, Plus, Minus, Equal, ArrowLeftRight } from "lucide-react";
import { useAppStore, HttpResponse } from "@/stores/appStore";
import { diffLines } from "diff";

interface DiffPanelProps {
  leftResponse: HttpResponse;
  rightResponse: HttpResponse;
  onClose: () => void;
}

function formatTimestamp(date: Date): string {
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatResponseBody(response: HttpResponse): string {
  const contentType = Object.entries(response.headers).find(
    ([key]) => key.toLowerCase() === "content-type"
  )?.[1];

  if (contentType?.includes("application/json")) {
    try {
      return JSON.stringify(JSON.parse(response.body), null, 2);
    } catch {
      return response.body;
    }
  }

  return response.body;
}

function getLanguageFromContentType(response: HttpResponse): string {
  const contentType = Object.entries(response.headers).find(
    ([key]) => key.toLowerCase() === "content-type"
  )?.[1];

  if (contentType?.includes("json")) return "json";
  if (contentType?.includes("xml")) return "xml";
  if (contentType?.includes("html")) return "html";
  if (contentType?.includes("javascript")) return "javascript";
  if (contentType?.includes("css")) return "css";

  return "plaintext";
}

interface DiffStats {
  additions: number;
  deletions: number;
  unchanged: number;
}

function computeDiffStats(left: string, right: string): DiffStats {
  const changes = diffLines(left, right);

  let additions = 0;
  let deletions = 0;
  let unchanged = 0;

  for (const change of changes) {
    const lineCount = change.count || 0;
    if (change.added) {
      additions += lineCount;
    } else if (change.removed) {
      deletions += lineCount;
    } else {
      unchanged += lineCount;
    }
  }

  return { additions, deletions, unchanged };
}

export function DiffPanel({ leftResponse, rightResponse, onClose }: DiffPanelProps) {
  const { isDarkMode } = useAppStore();

  // Define themes before the editor mounts
  const handleEditorBeforeMount: BeforeMount = (monaco) => {
    // Define Night Owl dark theme colors
    monaco.editor.defineTheme("kvile-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#011627",
        "editor.foreground": "#d6deeb",
        "editor.lineHighlightBackground": "#0b253a",
        "editor.selectionBackground": "#1d3b53",
        "editorCursor.foreground": "#80a4c2",
        "editorLineNumber.foreground": "#4b6479",
        "editorLineNumber.activeForeground": "#c5e4fd",
        "diffEditor.insertedTextBackground": "#addb6733",
        "diffEditor.removedTextBackground": "#ef535033",
      },
    });

    // Define Light Owl theme colors
    monaco.editor.defineTheme("kvile-light", {
      base: "vs",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#fbfbfb",
        "editor.foreground": "#403f53",
        "editor.lineHighlightBackground": "#f0f0f0",
        "editor.selectionBackground": "#e0e0e0",
        "editorCursor.foreground": "#90a7b2",
        "editorLineNumber.foreground": "#90a7b2",
        "editorLineNumber.activeForeground": "#403f53",
        "diffEditor.insertedTextBackground": "#2aa29833",
        "diffEditor.removedTextBackground": "#e64d4933",
      },
    });
  };

  const leftFormatted = useMemo(
    () => formatResponseBody(leftResponse),
    [leftResponse]
  );
  const rightFormatted = useMemo(
    () => formatResponseBody(rightResponse),
    [rightResponse]
  );

  const language = useMemo(
    () => getLanguageFromContentType(rightResponse),
    [rightResponse]
  );

  const diffStats = useMemo(
    () => computeDiffStats(leftFormatted, rightFormatted),
    [leftFormatted, rightFormatted]
  );

  const isIdentical =
    diffStats.additions === 0 && diffStats.deletions === 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg shadow-xl w-[95vw] h-[90vh] flex flex-col border border-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Response Diff</h3>
            </div>

            {/* Diff Stats */}
            <div className="flex items-center gap-3 text-sm">
              {isIdentical ? (
                <span className="text-muted-foreground">No differences</span>
              ) : (
                <>
                  <span className="flex items-center gap-1 text-green-500">
                    <Plus className="h-3.5 w-3.5" />
                    {diffStats.additions}
                  </span>
                  <span className="flex items-center gap-1 text-red-500">
                    <Minus className="h-3.5 w-3.5" />
                    {diffStats.deletions}
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Equal className="h-3.5 w-3.5" />
                    {diffStats.unchanged}
                  </span>
                </>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-accent transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Response Info Bar */}
        <div className="grid grid-cols-2 gap-4 p-3 text-sm border-b border-border bg-background">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Left (History):</span>
            <span
              className={
                leftResponse.status >= 200 && leftResponse.status < 300
                  ? "text-green-500"
                  : leftResponse.status >= 400
                  ? "text-red-500"
                  : "text-yellow-500"
              }
            >
              {leftResponse.status} {leftResponse.statusText}
            </span>
            <span className="text-muted-foreground">
              {formatTimestamp(leftResponse.timestamp)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Right (Current):</span>
            <span
              className={
                rightResponse.status >= 200 && rightResponse.status < 300
                  ? "text-green-500"
                  : rightResponse.status >= 400
                  ? "text-red-500"
                  : "text-yellow-500"
              }
            >
              {rightResponse.status} {rightResponse.statusText}
            </span>
            <span className="text-muted-foreground">
              {formatTimestamp(rightResponse.timestamp)}
            </span>
          </div>
        </div>

        {/* Diff Editor */}
        <div className="flex-1 overflow-hidden">
          <DiffEditor
            original={leftFormatted}
            modified={rightFormatted}
            language={language}
            beforeMount={handleEditorBeforeMount}
            theme={isDarkMode ? "kvile-dark" : "kvile-light"}
            options={{
              readOnly: true,
              renderSideBySide: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 13,
              fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
              lineNumbers: "on",
              renderLineHighlight: "none",
              scrollbar: {
                vertical: "auto",
                horizontal: "auto",
              },
            }}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-3 border-t border-border bg-muted/30">
          <div className="text-xs text-muted-foreground">
            Left: {leftFormatted.length} bytes | Right: {rightFormatted.length}{" "}
            bytes
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
