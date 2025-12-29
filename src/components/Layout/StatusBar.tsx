import { Wifi, WifiOff, Clock, HardDrive } from "lucide-react";
import { useAppStore } from "@/stores/appStore";

export function StatusBar() {
  const { currentResponse, isLoading, activeEnvironment } = useAppStore();

  return (
    <div className="h-6 flex items-center justify-between px-3 bg-primary text-primary-foreground text-xs border-t border-border">
      <div className="flex items-center gap-4">
        {/* Connection Status */}
        <div className="flex items-center gap-1">
          {isLoading ? (
            <>
              <div className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse" />
              <span>Sending...</span>
            </>
          ) : currentResponse ? (
            <>
              <Wifi className="h-3 w-3" />
              <span>
                {currentResponse.status} {currentResponse.statusText}
              </span>
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3 opacity-50" />
              <span>Ready</span>
            </>
          )}
        </div>

        {/* Response Time */}
        {currentResponse && (
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{currentResponse.time}ms</span>
          </div>
        )}

        {/* Response Size */}
        {currentResponse && (
          <div className="flex items-center gap-1">
            <HardDrive className="h-3 w-3" />
            <span>{formatBytes(currentResponse.size)}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Environment */}
        {activeEnvironment && (
          <div className="flex items-center gap-1.5">
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: getEnvironmentColor(activeEnvironment) }}
            />
            <span className="font-medium">{activeEnvironment}</span>
          </div>
        )}

        {/* Version */}
        <span className="opacity-70">Kvile v0.1.0</span>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getEnvironmentColor(env: string): string {
  switch (env.toLowerCase()) {
    case "dev":
    case "development":
    case "local":
      return "#22c55e"; // green
    case "staging":
    case "stage":
    case "test":
      return "#eab308"; // yellow
    case "prod":
    case "production":
      return "#ef4444"; // red
    default:
      return "#6b7280"; // gray
  }
}
