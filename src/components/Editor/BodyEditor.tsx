import { useState, useCallback } from "react";
import { Wand2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface BodyEditorProps {
  body: string | undefined;
  contentType: string | undefined;
  onChange: (body: string | undefined) => void;
  onContentTypeChange?: (contentType: string) => void;
  readOnly?: boolean;
}

const CONTENT_TYPES = [
  { value: "application/json", label: "JSON" },
  { value: "application/x-www-form-urlencoded", label: "Form URL Encoded" },
  { value: "text/plain", label: "Plain Text" },
  { value: "text/xml", label: "XML" },
  { value: "text/html", label: "HTML" },
  { value: "multipart/form-data", label: "Multipart Form" },
];

export function BodyEditor({
  body,
  contentType,
  onChange,
  onContentTypeChange,
  readOnly = false,
}: BodyEditorProps) {
  const [jsonError, setJsonError] = useState<string | null>(null);

  const isJson = contentType?.includes("json") || false;

  const handleBodyChange = useCallback(
    (value: string) => {
      onChange(value || undefined);

      // Validate JSON if content type is JSON
      if (isJson && value) {
        try {
          JSON.parse(value);
          setJsonError(null);
        } catch (e) {
          setJsonError((e as Error).message);
        }
      } else {
        setJsonError(null);
      }
    },
    [onChange, isJson]
  );

  const formatJson = useCallback(() => {
    if (!body || !isJson) return;

    try {
      const parsed = JSON.parse(body);
      const formatted = JSON.stringify(parsed, null, 2);
      onChange(formatted);
      setJsonError(null);
    } catch (e) {
      setJsonError((e as Error).message);
    }
  }, [body, isJson, onChange]);

  return (
    <div className="h-full flex flex-col gap-2">
      {/* Content Type Selector */}
      {onContentTypeChange && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Content-Type:</label>
          <select
            value={contentType || ""}
            onChange={(e) => onContentTypeChange(e.target.value)}
            disabled={readOnly}
            className="px-2 py-1 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">None</option>
            {CONTENT_TYPES.map((ct) => (
              <option key={ct.value} value={ct.value}>
                {ct.label}
              </option>
            ))}
          </select>

          {/* Format JSON button */}
          {isJson && body && (
            <button
              onClick={formatJson}
              disabled={readOnly}
              className={cn(
                "flex items-center gap-1 px-2 py-1 text-xs rounded",
                "bg-muted hover:bg-accent transition-colors",
                "disabled:opacity-50"
              )}
              title="Format JSON"
            >
              <Wand2 className="h-3 w-3" />
              Format
            </button>
          )}
        </div>
      )}

      {/* Body Textarea */}
      <div className="flex-1 relative">
        <textarea
          value={body || ""}
          onChange={(e) => handleBodyChange(e.target.value)}
          placeholder={isJson ? '{\n  "key": "value"\n}' : "Request body..."}
          disabled={readOnly}
          className={cn(
            "w-full h-full min-h-[200px] p-3 text-sm bg-background border rounded-md resize-none",
            "font-mono focus:outline-none focus:ring-1 focus:ring-ring",
            jsonError ? "border-destructive" : "border-input"
          )}
          spellCheck={false}
        />

        {/* JSON Error indicator */}
        {jsonError && (
          <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2 px-2 py-1 bg-destructive/10 border border-destructive/20 rounded text-xs text-destructive">
            <AlertCircle className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{jsonError}</span>
          </div>
        )}
      </div>
    </div>
  );
}
