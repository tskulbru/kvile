import { Trash2, Variable } from "lucide-react";
import { useScriptStore } from "@/stores/scriptStore";

export function ResponseVariablesPanel() {
  const { responseVariables, clearAllVariables } = useScriptStore();

  const variables = Object.entries(responseVariables);

  if (variables.length === 0) {
    return (
      <div className="p-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-2 mb-2">
          <Variable className="h-4 w-4" />
          <span className="font-medium">Response Variables</span>
        </div>
        <p className="text-xs">
          No variables captured yet. Use{" "}
          <code className="bg-muted px-1 rounded">client.global.set()</code> in
          response scripts to capture values.
        </p>
      </div>
    );
  }

  return (
    <div className="p-2">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <Variable className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold">Response Variables</span>
          <span className="text-xs text-muted-foreground">
            ({variables.length})
          </span>
        </div>
        <button
          onClick={clearAllVariables}
          className="p-1 rounded hover:bg-accent transition-colors"
          title="Clear all variables"
        >
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      <div className="space-y-1">
        {variables.map(([name, variable]) => (
          <div
            key={name}
            className="px-2 py-1.5 rounded bg-muted/50 hover:bg-muted transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm text-primary">
                {"{{"}
                {name}
                {"}}"}
              </span>
              <span className="text-xs text-muted-foreground">
                {variable.source}
              </span>
            </div>
            <div className="text-xs text-muted-foreground truncate mt-0.5 font-mono">
              {formatValue(variable.value)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatValue(value: unknown): string {
  if (typeof value === "string") {
    // Truncate long strings
    if (value.length > 50) {
      return `"${value.substring(0, 50)}..."`;
    }
    return `"${value}"`;
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
  // Objects and arrays
  const json = JSON.stringify(value);
  if (json.length > 50) {
    return json.substring(0, 50) + "...";
  }
  return json;
}
