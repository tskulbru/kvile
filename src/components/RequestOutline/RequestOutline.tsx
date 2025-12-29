import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ParsedRequest } from "@/lib/tauri";

interface RequestOutlineProps {
  requests: ParsedRequest[];
  onRequestClick: (request: ParsedRequest) => void;
  onRunRequest?: (request: ParsedRequest) => void;
  activeLineNumber?: number;
}

const METHOD_COLORS: Record<string, string> = {
  GET: "text-green-500",
  POST: "text-blue-500",
  PUT: "text-yellow-500",
  PATCH: "text-orange-500",
  DELETE: "text-red-500",
  HEAD: "text-purple-500",
  OPTIONS: "text-gray-500",
};

function truncateUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname + parsed.search;
  } catch {
    return url.length > 30 ? url.slice(0, 30) + "..." : url;
  }
}

function isRequestActive(
  request: ParsedRequest,
  activeLineNumber: number | undefined,
  requests: ParsedRequest[],
  index: number
): boolean {
  if (activeLineNumber === undefined) return false;

  const nextRequest = requests[index + 1];
  const startLine = request.line_number;
  const endLine = nextRequest ? nextRequest.line_number - 1 : Infinity;

  return activeLineNumber >= startLine && activeLineNumber <= endLine;
}

export function RequestOutline({
  requests,
  onRequestClick,
  onRunRequest,
  activeLineNumber,
}: RequestOutlineProps) {
  if (requests.length === 0) {
    return (
      <div className="px-2 py-3 text-sm text-muted-foreground">
        No requests found
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      <div className="text-xs font-medium text-muted-foreground px-2 py-1 uppercase tracking-wider">
        Requests ({requests.length})
      </div>
      {requests.map((request, index) => {
        const isActive = isRequestActive(request, activeLineNumber, requests, index);

        return (
          <div
            key={`${request.line_number}-${index}`}
            onClick={() => onRequestClick(request)}
            className={cn(
              "group flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded-sm",
              "hover:bg-accent transition-colors text-sm",
              isActive && "bg-accent"
            )}
          >
            <span
              className={cn(
                "font-mono text-xs font-semibold w-12 flex-shrink-0",
                METHOD_COLORS[request.method] || "text-muted-foreground"
              )}
            >
              {request.method}
            </span>
            <span className="flex-1 truncate text-foreground/80">
              {request.name || truncateUrl(request.url)}
            </span>
            {onRunRequest && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRunRequest(request);
                }}
                className="p-1 rounded hover:bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                title="Run request (Ctrl+Enter)"
              >
                <Play className="h-3 w-3 text-primary" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
