import { useState, useCallback } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeadersEditorProps {
  headers: Record<string, string>;
  onChange: (headers: Record<string, string>) => void;
  readOnly?: boolean;
}

interface HeaderRow {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

// Common header suggestions for autocomplete
const COMMON_HEADERS = [
  "Accept",
  "Accept-Encoding",
  "Accept-Language",
  "Authorization",
  "Cache-Control",
  "Content-Type",
  "Cookie",
  "Host",
  "Origin",
  "Referer",
  "User-Agent",
  "X-API-Key",
  "X-Request-ID",
];

export function HeadersEditor({ headers, onChange, readOnly = false }: HeadersEditorProps) {
  // Convert headers object to array of rows for editing
  const [rows, setRows] = useState<HeaderRow[]>(() => {
    const entries = Object.entries(headers);
    if (entries.length === 0) {
      // Start with one empty row
      return [{ id: crypto.randomUUID(), key: "", value: "", enabled: true }];
    }
    return entries.map(([key, value]) => ({
      id: crypto.randomUUID(),
      key,
      value,
      enabled: true,
    }));
  });

  // Sync rows back to parent
  const syncToParent = useCallback(
    (newRows: HeaderRow[]) => {
      const newHeaders: Record<string, string> = {};
      for (const row of newRows) {
        if (row.enabled && row.key.trim()) {
          newHeaders[row.key.trim()] = row.value;
        }
      }
      onChange(newHeaders);
    },
    [onChange]
  );

  const updateRow = (id: string, field: "key" | "value" | "enabled", newValue: string | boolean) => {
    const newRows = rows.map((row) =>
      row.id === id ? { ...row, [field]: newValue } : row
    );
    setRows(newRows);
    syncToParent(newRows);
  };

  const addRow = () => {
    const newRows = [...rows, { id: crypto.randomUUID(), key: "", value: "", enabled: true }];
    setRows(newRows);
  };

  const removeRow = (id: string) => {
    if (rows.length === 1) {
      // Keep at least one row, just clear it
      const newRows = [{ id: crypto.randomUUID(), key: "", value: "", enabled: true }];
      setRows(newRows);
      syncToParent(newRows);
    } else {
      const newRows = rows.filter((row) => row.id !== id);
      setRows(newRows);
      syncToParent(newRows);
    }
  };

  return (
    <div className="space-y-1">
      {/* Header Row Labels */}
      <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground font-medium">
        <div className="w-6" /> {/* Checkbox space */}
        <div className="flex-1">Key</div>
        <div className="flex-1">Value</div>
        <div className="w-8" /> {/* Delete button space */}
      </div>

      {/* Rows */}
      <div className="space-y-1">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={row.enabled}
              onChange={(e) => updateRow(row.id, "enabled", e.target.checked)}
              disabled={readOnly}
              className="h-4 w-4 rounded border-input"
              title={row.enabled ? "Disable header" : "Enable header"}
            />
            <input
              type="text"
              value={row.key}
              onChange={(e) => updateRow(row.id, "key", e.target.value)}
              placeholder="Header name"
              disabled={readOnly}
              list="header-suggestions"
              className={cn(
                "flex-1 px-2 py-1.5 text-sm bg-background border border-input rounded-md",
                "focus:outline-none focus:ring-1 focus:ring-ring",
                !row.enabled && "opacity-50"
              )}
            />
            <input
              type="text"
              value={row.value}
              onChange={(e) => updateRow(row.id, "value", e.target.value)}
              placeholder="Value"
              disabled={readOnly}
              className={cn(
                "flex-1 px-2 py-1.5 text-sm bg-background border border-input rounded-md",
                "focus:outline-none focus:ring-1 focus:ring-ring font-mono",
                !row.enabled && "opacity-50"
              )}
            />
            <button
              onClick={() => removeRow(row.id)}
              disabled={readOnly}
              className={cn(
                "p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive",
                "transition-colors disabled:opacity-50"
              )}
              title="Remove header"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Add Row Button */}
      {!readOnly && (
        <button
          onClick={addRow}
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 text-sm text-muted-foreground",
            "hover:text-foreground hover:bg-accent rounded transition-colors"
          )}
        >
          <Plus className="h-3.5 w-3.5" />
          Add header
        </button>
      )}

      {/* Datalist for header suggestions */}
      <datalist id="header-suggestions">
        {COMMON_HEADERS.map((header) => (
          <option key={header} value={header} />
        ))}
      </datalist>
    </div>
  );
}
