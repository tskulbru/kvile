import { X, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RunAllResult } from "@/stores/appStore";

interface RunAllResultsProps {
  results: RunAllResult;
  onClose: () => void;
  onViewResponse: (index: number) => void;
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

export function RunAllResults({
  results,
  onClose,
  onViewResponse,
}: RunAllResultsProps) {
  return (
    <div className="h-full flex flex-col bg-card">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-4">
          <h3 className="font-semibold">Run All Results</h3>
          <div className="flex gap-3 text-sm">
            <span className="text-green-500 font-medium">
              {results.successful} passed
            </span>
            <span className="text-red-500 font-medium">
              {results.failed} failed
            </span>
            <span className="text-muted-foreground">
              {results.total} total
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-accent transition-colors"
          title="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Results List */}
      <div className="flex-1 overflow-auto p-2">
        <div className="space-y-1">
          {results.results.map((result, index) => (
            <div
              key={index}
              onClick={() => result.response && onViewResponse(index)}
              className={cn(
                "flex items-center gap-2 p-2 rounded",
                "hover:bg-muted/50 transition-colors",
                result.response ? "cursor-pointer" : "opacity-60"
              )}
            >
              {/* Status Icon */}
              {result.response ? (
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
              )}

              {/* Method */}
              <span
                className={cn(
                  "font-mono text-xs font-semibold w-12 flex-shrink-0",
                  METHOD_COLORS[result.request.method] || "text-muted-foreground"
                )}
              >
                {result.request.method}
              </span>

              {/* URL/Name */}
              <span className="flex-1 truncate text-sm">
                {result.request.name || result.request.url}
              </span>

              {/* Status Code */}
              {result.response && (
                <span
                  className={cn(
                    "text-xs font-medium",
                    result.response.status >= 400 ? "text-red-500" : "text-green-500"
                  )}
                >
                  {result.response.status}
                </span>
              )}

              {/* Error */}
              {result.error && (
                <span className="text-xs text-red-500 truncate max-w-[150px]" title={result.error}>
                  {result.error}
                </span>
              )}

              {/* Duration */}
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {result.duration}ms
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
