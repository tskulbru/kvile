import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { ParsedRequest } from "@/lib/tauri";
import { HeadersEditor } from "./HeadersEditor";
import { BodyEditor } from "./BodyEditor";

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-green-500/10 text-green-600 border-green-500/30",
  POST: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  PUT: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
  PATCH: "bg-orange-500/10 text-orange-600 border-orange-500/30",
  DELETE: "bg-red-500/10 text-red-600 border-red-500/30",
  HEAD: "bg-purple-500/10 text-purple-600 border-purple-500/30",
  OPTIONS: "bg-gray-500/10 text-gray-600 border-gray-500/30",
};

type TabType = "headers" | "body" | "auth";

interface RequestEditorProps {
  request: ParsedRequest;
  onRequestChange: (updates: Partial<ParsedRequest>) => void;
  variables?: Record<string, string>;
  readOnly?: boolean;
}

export function RequestEditor({
  request,
  onRequestChange,
  variables = {},
  readOnly = false,
}: RequestEditorProps) {
  const [activeTab, setActiveTab] = useState<TabType>("headers");

  // Extract content-type from headers for body editor
  const contentType = Object.entries(request.headers).find(
    ([key]) => key.toLowerCase() === "content-type"
  )?.[1];

  const handleMethodChange = useCallback(
    (method: string) => {
      onRequestChange({ method });
    },
    [onRequestChange]
  );

  const handleUrlChange = useCallback(
    (url: string) => {
      onRequestChange({ url });
    },
    [onRequestChange]
  );

  const handleHeadersChange = useCallback(
    (headers: Record<string, string>) => {
      onRequestChange({ headers });
    },
    [onRequestChange]
  );

  const handleBodyChange = useCallback(
    (body: string | undefined) => {
      onRequestChange({ body });
    },
    [onRequestChange]
  );

  const handleContentTypeChange = useCallback(
    (newContentType: string) => {
      const newHeaders = { ...request.headers };
      // Remove existing content-type header (case-insensitive)
      for (const key of Object.keys(newHeaders)) {
        if (key.toLowerCase() === "content-type") {
          delete newHeaders[key];
        }
      }
      // Add new content-type if set
      if (newContentType) {
        newHeaders["Content-Type"] = newContentType;
      }
      onRequestChange({ headers: newHeaders });
    },
    [request.headers, onRequestChange]
  );

  // Count headers and body size for tab badges
  const headerCount = Object.keys(request.headers).length;
  const hasBody = !!request.body;

  return (
    <div className="h-full flex flex-col">
      {/* Request Name (if set) */}
      {request.name && (
        <div className="px-4 py-2 border-b border-border bg-muted/30">
          <span className="text-sm font-medium">{request.name}</span>
        </div>
      )}

      {/* Method + URL Bar */}
      <div className="flex items-center gap-2 p-4 border-b border-border">
        <select
          value={request.method}
          onChange={(e) => handleMethodChange(e.target.value)}
          disabled={readOnly}
          className={cn(
            "px-3 py-2 text-sm font-semibold rounded-md border",
            "focus:outline-none focus:ring-2 focus:ring-ring",
            METHOD_COLORS[request.method] || "bg-muted"
          )}
        >
          {HTTP_METHODS.map((method) => (
            <option key={method} value={method}>
              {method}
            </option>
          ))}
        </select>

        <input
          type="text"
          value={request.url}
          onChange={(e) => handleUrlChange(e.target.value)}
          placeholder="https://api.example.com/endpoint"
          disabled={readOnly}
          className={cn(
            "flex-1 px-3 py-2 text-sm bg-background border border-input rounded-md",
            "font-mono focus:outline-none focus:ring-2 focus:ring-ring"
          )}
        />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <TabButton
          active={activeTab === "headers"}
          onClick={() => setActiveTab("headers")}
          badge={headerCount > 0 ? headerCount : undefined}
        >
          Headers
        </TabButton>
        <TabButton
          active={activeTab === "body"}
          onClick={() => setActiveTab("body")}
          badge={hasBody ? "1" : undefined}
        >
          Body
        </TabButton>
        <TabButton
          active={activeTab === "auth"}
          onClick={() => setActiveTab("auth")}
        >
          Auth
        </TabButton>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === "headers" && (
          <HeadersEditor
            headers={request.headers}
            onChange={handleHeadersChange}
            readOnly={readOnly}
          />
        )}

        {activeTab === "body" && (
          <BodyEditor
            body={request.body}
            contentType={contentType}
            onChange={handleBodyChange}
            onContentTypeChange={handleContentTypeChange}
            readOnly={readOnly}
          />
        )}

        {activeTab === "auth" && (
          <AuthTab
            metadata={request.metadata}
            headers={request.headers}
            onHeadersChange={handleHeadersChange}
            readOnly={readOnly}
          />
        )}
      </div>

      {/* Variables hint */}
      {Object.keys(variables).length > 0 && (
        <div className="px-4 py-2 border-t border-border bg-muted/30 text-xs text-muted-foreground">
          <span className="font-medium">{Object.keys(variables).length} variables</span> available.
          Use <code className="px-1 py-0.5 bg-muted rounded">{"{{variableName}}"}</code> syntax.
        </div>
      )}
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  badge?: string | number;
}

function TabButton({ active, onClick, children, badge }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors",
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted"
      )}
    >
      {children}
      {badge !== undefined && (
        <span
          className={cn(
            "px-1.5 py-0.5 text-xs rounded-full",
            active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          )}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

interface AuthTabProps {
  metadata: Record<string, string>;
  headers: Record<string, string>;
  onHeadersChange: (headers: Record<string, string>) => void;
  readOnly?: boolean;
}

function AuthTab({ metadata, headers, onHeadersChange, readOnly }: AuthTabProps) {
  // Check if auth is configured via metadata or headers
  const authType = metadata?.["auth"] || (headers["Authorization"] ? "bearer" : "none");
  const authValue = headers["Authorization"] || "";

  const handleAuthTypeChange = (type: string) => {
    const newHeaders = { ...headers };
    if (type === "none") {
      // Remove Authorization header
      delete newHeaders["Authorization"];
    } else if (type === "bearer") {
      // Set placeholder for bearer token
      newHeaders["Authorization"] = headers["Authorization"] || "Bearer ";
    } else if (type === "basic") {
      // Set placeholder for basic auth
      newHeaders["Authorization"] = headers["Authorization"] || "Basic ";
    } else if (type === "apikey") {
      // Keep existing or set empty for API key
      newHeaders["Authorization"] = headers["Authorization"] || "";
    }
    onHeadersChange(newHeaders);
  };

  const handleAuthValueChange = (value: string) => {
    onHeadersChange({ ...headers, Authorization: value });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium">Auth Type:</label>
        <select
          value={authType}
          onChange={(e) => handleAuthTypeChange(e.target.value)}
          disabled={readOnly}
          className="px-2 py-1.5 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="none">None</option>
          <option value="bearer">Bearer Token</option>
          <option value="basic">Basic Auth</option>
          <option value="apikey">API Key</option>
        </select>
      </div>

      {authType !== "none" && (
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Authorization Header:</label>
          <input
            type="text"
            value={authValue}
            onChange={(e) => handleAuthValueChange(e.target.value)}
            placeholder={authType === "bearer" ? "Bearer your-token-here" : "Authorization value"}
            disabled={readOnly}
            className={cn(
              "w-full px-3 py-2 text-sm bg-background border border-input rounded-md",
              "font-mono focus:outline-none focus:ring-1 focus:ring-ring"
            )}
          />
          <p className="text-xs text-muted-foreground">
            {authType === "bearer" && "Enter your Bearer token (without the 'Bearer ' prefix if using a variable)"}
            {authType === "basic" && "Enter Base64 encoded credentials (username:password)"}
            {authType === "apikey" && "Enter your API key"}
          </p>
        </div>
      )}

      {/* Show metadata-based auth info if present */}
      {Object.keys(metadata).filter((k) => k.startsWith("auth")).length > 0 && (
        <div className="mt-4 p-3 bg-muted/50 rounded-md">
          <p className="text-xs text-muted-foreground mb-2">Auth directives from file:</p>
          {Object.entries(metadata)
            .filter(([k]) => k.startsWith("auth"))
            .map(([key, value]) => (
              <div key={key} className="text-xs font-mono">
                <span className="text-muted-foreground"># @{key}</span> {value}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
