import { X, Trash2 } from "lucide-react";
import { useAppStore } from "@/stores/appStore";
import { useScriptStore } from "@/stores/scriptStore";
import { extractInlineVariables } from "@/lib/variables";

interface EnvironmentPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EnvironmentPanel({ isOpen, onClose }: EnvironmentPanelProps) {
  const {
    environmentConfig,
    activeEnvironment,
    getCurrentVariables,
    openFiles,
    activeFileIndex,
  } = useAppStore();

  if (!isOpen) return null;

  const envVariables = getCurrentVariables();
  const env = environmentConfig?.environments.find(
    (e) => e.name === activeEnvironment
  );

  // Get response variables from script store
  const { responseVariables, clearAllVariables } = useScriptStore();
  const hasResponseVars = Object.keys(responseVariables).length > 0;

  // Get inline variables from the active file
  const activeFile = activeFileIndex >= 0 ? openFiles[activeFileIndex] : null;
  const inlineVariables = activeFile ? extractInlineVariables(activeFile.content) : {};
  const hasInlineVars = Object.keys(inlineVariables).length > 0;
  const hasEnvVars = Object.keys(envVariables).length > 0;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-card p-6 rounded-lg shadow-xl w-[500px] max-h-[80vh] overflow-hidden flex flex-col border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            Environment: {activeEnvironment || "None"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-accent transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {env && (
          <div className="text-xs text-muted-foreground mb-4 truncate">
            Source: {env.source_file}
          </div>
        )}

        <div className="flex-1 overflow-auto">
          {!hasInlineVars && !hasEnvVars && !hasResponseVars ? (
            <div className="text-center text-muted-foreground py-8">
              No variables defined
            </div>
          ) : (
            <div className="space-y-4">
              {/* Response Variables (from scripts) */}
              {hasResponseVars && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      Response Variables
                      <span className="text-xs font-normal opacity-70">
                        (from scripts)
                      </span>
                    </h3>
                    <button
                      onClick={clearAllVariables}
                      className="p-1 rounded hover:bg-accent transition-colors"
                      title="Clear all response variables"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                  <table className="w-full text-sm">
                    <tbody>
                      {Object.entries(responseVariables).map(([key, variable]) => (
                        <tr key={key} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-2 px-2 font-mono text-orange-500">{key}</td>
                          <td className="py-2 px-2 font-mono truncate max-w-[200px]" title={formatResponseValue(variable.value)}>
                            {maskSensitive(key, formatResponseValue(variable.value))}
                          </td>
                          <td className="py-2 px-2 text-xs text-muted-foreground truncate max-w-[100px]" title={variable.source}>
                            {variable.source}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Inline File Variables */}
              {hasInlineVars && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                    File Variables
                    {activeFile && (
                      <span className="text-xs font-normal opacity-70">
                        ({activeFile.name})
                      </span>
                    )}
                  </h3>
                  <table className="w-full text-sm">
                    <tbody>
                      {Object.entries(inlineVariables).map(([key, value]) => (
                        <tr key={key} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-2 px-2 font-mono text-green-500">{key}</td>
                          <td className="py-2 px-2 font-mono truncate max-w-[250px]" title={value}>
                            {maskSensitive(key, value)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Environment Variables */}
              {hasEnvVars && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">
                    Environment Variables
                  </h3>
                  <table className="w-full text-sm">
                    <tbody>
                      {Object.entries(envVariables).map(([key, value]) => (
                        <tr key={key} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-2 px-2 font-mono text-primary">{key}</td>
                          <td className="py-2 px-2 font-mono truncate max-w-[250px]" title={value}>
                            {maskSensitive(key, value)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Shared Variables */}
              {environmentConfig?.shared && Object.keys(environmentConfig.shared).length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">
                    Shared Variables
                  </h3>
                  <table className="w-full text-sm">
                    <tbody>
                      {Object.entries(environmentConfig.shared).map(([key, value]) => (
                        <tr key={key} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-2 px-2 font-mono text-muted-foreground">{key}</td>
                          <td className="py-2 px-2 font-mono truncate max-w-[250px]" title={value}>
                            {maskSensitive(key, value)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function maskSensitive(key: string, value: string): string {
  const sensitiveKeys = ["token", "password", "secret", "key", "auth", "api_key", "apikey"];
  const isSensitive = sensitiveKeys.some((k) =>
    key.toLowerCase().includes(k)
  );

  if (isSensitive && value.length > 4) {
    return value.slice(0, 4) + "••••••••";
  }
  return value;
}

function formatResponseValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value === null) {
    return "null";
  }
  if (value === undefined) {
    return "undefined";
  }
  return JSON.stringify(value);
}
