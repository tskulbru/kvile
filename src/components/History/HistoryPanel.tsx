import { useState } from "react";
import {
  X,
  Clock,
  RotateCcw,
  Trash2,
  ChevronRight,
  ChevronDown,
  ArrowLeftRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { HistoryEntry } from "@/lib/tauri";

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  entries: HistoryEntry[];
  isLoading: boolean;
  onViewEntry: (entry: HistoryEntry) => void;
  onRerunEntry: (entry: HistoryEntry) => void;
  onDeleteEntry: (id: number) => void;
  onClearHistory: () => void;
  onCompareEntry?: (entry: HistoryEntry) => void;
  /** Whether the Compare button should be shown (has current response) */
  canCompare?: boolean;
  /** Whether we're in compare mode (filters to same endpoint) */
  compareMode?: boolean;
  /** Current request URL for filtering when in compare mode */
  currentUrl?: string;
  /** Current request method for filtering when in compare mode */
  currentMethod?: string;
}

const METHOD_COLORS: Record<string, string> = {
  GET: "text-green-500 bg-green-500/10",
  POST: "text-blue-500 bg-blue-500/10",
  PUT: "text-yellow-500 bg-yellow-500/10",
  PATCH: "text-orange-500 bg-orange-500/10",
  DELETE: "text-red-500 bg-red-500/10",
  HEAD: "text-purple-500 bg-purple-500/10",
  OPTIONS: "text-gray-500 bg-gray-500/10",
};

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncateUrl(url: string, maxLength = 50): string {
  if (url.length <= maxLength) return url;
  return url.substring(0, maxLength - 3) + "...";
}

function HistoryEntryItem({
  entry,
  onView,
  onRerun,
  onDelete,
  onCompare,
  canCompare,
}: {
  entry: HistoryEntry;
  onView: () => void;
  onRerun: () => void;
  onDelete: () => void;
  onCompare?: () => void;
  canCompare?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isError = entry.status >= 400;

  return (
    <div className="border-b border-border last:border-0">
      <div
        className="flex items-center gap-2 p-2 hover:bg-accent/50 cursor-pointer transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <button className="p-0.5">
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>

        <span
          className={cn(
            "px-1.5 py-0.5 rounded text-xs font-mono font-semibold flex-shrink-0",
            METHOD_COLORS[entry.method] || "text-muted-foreground bg-muted"
          )}
        >
          {entry.method}
        </span>

        <span className="flex-1 text-sm truncate font-mono">
          {entry.request_name || truncateUrl(entry.url)}
        </span>

        <span
          className={cn(
            "text-xs font-mono font-medium flex-shrink-0",
            isError ? "text-red-500" : "text-green-500"
          )}
        >
          {entry.status}
        </span>

        <span className="text-xs text-muted-foreground flex-shrink-0">
          {entry.duration_ms}ms
        </span>

        <span className="text-xs text-muted-foreground flex-shrink-0">
          {formatTimestamp(entry.timestamp)}
        </span>
      </div>

      {expanded && (
        <div className="px-8 pb-3 space-y-2 bg-muted/30">
          <div className="text-xs text-muted-foreground font-mono break-all">
            {entry.url}
          </div>

          {entry.request_name && (
            <div className="text-xs text-muted-foreground">
              Name: {entry.request_name}
            </div>
          )}

          {entry.file_path && (
            <div className="text-xs text-muted-foreground">
              File: {entry.file_path.split("/").pop()}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onView();
              }}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
            >
              View Response
            </button>
            {canCompare && onCompare && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCompare();
                }}
                className="flex items-center gap-1 px-2 py-1 text-xs border border-input rounded hover:bg-accent transition-colors"
                title="Compare this response with the current response"
              >
                <ArrowLeftRight className="h-3 w-3" />
                Compare
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRerun();
              }}
              className="flex items-center gap-1 px-2 py-1 text-xs border border-input rounded hover:bg-accent transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Re-run
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="flex items-center gap-1 px-2 py-1 text-xs border border-input rounded hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Extract the path from a URL for comparison purposes.
 * This handles both full URLs and path-only strings.
 */
function getUrlPath(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname;
  } catch {
    // If it's not a valid URL, assume it's already a path or has a variable
    // Extract everything after the host-like pattern
    const match = url.match(/^(?:https?:\/\/)?[^/]*(\/.*)?$/);
    return match?.[1] || url;
  }
}

export function HistoryPanel({
  isOpen,
  onClose,
  entries,
  isLoading,
  onViewEntry,
  onRerunEntry,
  onDeleteEntry,
  onClearHistory,
  onCompareEntry,
  canCompare,
  compareMode,
  currentUrl,
  currentMethod,
}: HistoryPanelProps) {
  const [confirmClear, setConfirmClear] = useState(false);

  if (!isOpen) return null;

  // Filter entries when in compare mode - only show entries with matching URL path and method
  const displayEntries = compareMode && currentUrl
    ? entries.filter((entry) => {
        const currentPath = getUrlPath(currentUrl);
        const entryPath = getUrlPath(entry.url);
        const pathMatches = currentPath === entryPath;
        const methodMatches = !currentMethod || entry.method === currentMethod;
        return pathMatches && methodMatches;
      })
    : entries;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-2xl max-h-[80vh] bg-card border border-border rounded-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">
              {compareMode ? "Compare with Previous" : "Request History"}
            </h2>
            <span className="text-sm text-muted-foreground">
              ({displayEntries.length}{compareMode ? ` matching` : ""} entries)
            </span>
          </div>
          <div className="flex items-center gap-2">
            {entries.length > 0 && (
              confirmClear ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Clear all?</span>
                  <button
                    onClick={() => {
                      onClearHistory();
                      setConfirmClear(false);
                    }}
                    className="px-2 py-1 text-xs bg-destructive text-destructive-foreground rounded hover:bg-destructive/90"
                  >
                    Yes, clear
                  </button>
                  <button
                    onClick={() => setConfirmClear(false)}
                    className="px-2 py-1 text-xs border border-input rounded hover:bg-accent"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmClear(true)}
                  className="flex items-center gap-1 px-2 py-1 text-xs border border-input rounded hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50 transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                  Clear All
                </button>
              )
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-accent transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center p-8 text-muted-foreground">
              <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full mr-2" />
              Loading history...
            </div>
          ) : displayEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
              <Clock className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-sm font-medium">
                {compareMode ? "No matching history" : "No history yet"}
              </p>
              <p className="text-xs mt-1">
                {compareMode
                  ? "No previous responses found for this endpoint"
                  : "Request history will appear here after you send requests"}
              </p>
            </div>
          ) : (
            <div>
              {displayEntries.map((entry) => (
                <HistoryEntryItem
                  key={entry.id}
                  entry={entry}
                  onView={() => onViewEntry(entry)}
                  onRerun={() => onRerunEntry(entry)}
                  onDelete={() => onDeleteEntry(entry.id)}
                  onCompare={onCompareEntry ? () => onCompareEntry(entry) : undefined}
                  canCompare={canCompare}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border bg-muted/30 text-xs text-muted-foreground">
          History is stored locally and persists across sessions
        </div>
      </div>
    </div>
  );
}
