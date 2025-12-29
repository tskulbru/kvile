import { CheckCircle, XCircle, Terminal, X, Trash2 } from "lucide-react";
import { useScriptStore } from "@/stores/scriptStore";
import { cn } from "@/lib/utils";

export function TestResultsPanel() {
  const {
    lastTestResults,
    lastScriptLogs,
    showScriptConsole,
    setShowScriptConsole,
    clearTestResults,
    clearLogs,
  } = useScriptStore();

  if (!showScriptConsole) return null;

  const passedCount = lastTestResults.filter((r) => r.passed).length;
  const failedCount = lastTestResults.filter((r) => !r.passed).length;
  const hasTests = lastTestResults.length > 0;
  const hasLogs = lastScriptLogs.length > 0;

  if (!hasTests && !hasLogs) return null;

  return (
    <div className="border-t border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Script Output</span>
          </div>
          {hasTests && (
            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1 text-green-500">
                <CheckCircle className="h-3 w-3" />
                {passedCount} passed
              </span>
              {failedCount > 0 && (
                <span className="flex items-center gap-1 text-red-500">
                  <XCircle className="h-3 w-3" />
                  {failedCount} failed
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              clearTestResults();
              clearLogs();
            }}
            className="p-1 rounded hover:bg-accent transition-colors"
            title="Clear"
          >
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <button
            onClick={() => setShowScriptConsole(false)}
            className="p-1 rounded hover:bg-accent transition-colors"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-h-48 overflow-auto">
        {/* Test Results */}
        {hasTests && (
          <div className="p-2 space-y-1">
            {lastTestResults.map((result, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded text-sm",
                  result.passed
                    ? "bg-green-500/10 text-green-700 dark:text-green-400"
                    : "bg-red-500/10 text-red-700 dark:text-red-400"
                )}
              >
                {result.passed ? (
                  <CheckCircle className="h-4 w-4 flex-shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 flex-shrink-0" />
                )}
                <span className="flex-1">{result.name}</span>
                {result.error && (
                  <span className="text-xs opacity-75 truncate max-w-[200px]">
                    {result.error}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Console Logs */}
        {hasLogs && (
          <div className="border-t border-border">
            <div className="px-3 py-1 text-xs text-muted-foreground bg-muted/30">
              Console
            </div>
            <div className="p-2 font-mono text-xs space-y-0.5 bg-black/5 dark:bg-black/20">
              {lastScriptLogs.map((log, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-start gap-2",
                    log.level === "error" && "text-red-500",
                    log.level === "warn" && "text-yellow-500",
                    log.level === "log" && "text-muted-foreground"
                  )}
                >
                  <span className="text-muted-foreground/50 select-none">&gt;</span>
                  <span className="whitespace-pre-wrap break-all">{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
