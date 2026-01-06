import { useState, useCallback } from "react";
import { X, Plus, Trash2, AlertCircle, Loader2, Lock } from "lucide-react";
import { saveEnvironment, isTauriAvailable } from "@/lib/tauri";
import { useAppStore } from "@/stores/appStore";

interface VariableRow {
  id: string;
  key: string;
  value: string;
}

interface CreateEnvironmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  existingEnvironments: string[];
}

export function CreateEnvironmentDialog({
  isOpen,
  onClose,
  existingEnvironments,
}: CreateEnvironmentDialogProps) {
  // All hooks must be called before any conditional returns
  const { workspacePath, loadEnvironments, setActiveEnvironment } = useAppStore();
  const [envName, setEnvName] = useState("");
  const [variables, setVariables] = useState<VariableRow[]>([
    { id: crypto.randomUUID(), key: "", value: "" },
  ]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = useCallback(async () => {
    // Validation
    const trimmedName = envName.trim();
    if (!trimmedName) {
      setError("Environment name is required");
      return;
    }

    if (existingEnvironments.includes(trimmedName)) {
      setError(`Environment "${trimmedName}" already exists`);
      return;
    }

    if (!workspacePath) {
      setError("No workspace is open");
      return;
    }

    if (!isTauriAvailable()) {
      setError("Not running in Tauri context");
      return;
    }

    // Build variables object, filtering out empty keys
    const varsObj: Record<string, string> = {};
    for (const v of variables) {
      const key = v.key.trim();
      if (key) {
        varsObj[key] = v.value;
      }
    }

    if (Object.keys(varsObj).length === 0) {
      setError("At least one variable is required");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      await saveEnvironment(workspacePath, trimmedName, varsObj, isPrivate);
      await loadEnvironments();
      setActiveEnvironment(trimmedName);
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setIsSaving(false);
    }
  }, [
    envName,
    variables,
    isPrivate,
    workspacePath,
    existingEnvironments,
    loadEnvironments,
    setActiveEnvironment,
    onClose,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  // Early return AFTER all hooks are called
  if (!isOpen) return null;

  const handleAddVariable = () => {
    setVariables([...variables, { id: crypto.randomUUID(), key: "", value: "" }]);
  };

  const handleRemoveVariable = (id: string) => {
    if (variables.length > 1) {
      setVariables(variables.filter((v) => v.id !== id));
    }
  };

  const handleVariableChange = (
    id: string,
    field: "key" | "value",
    newValue: string
  ) => {
    setVariables(
      variables.map((v) => (v.id === id ? { ...v, [field]: newValue } : v))
    );
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-card p-6 rounded-lg shadow-xl w-[500px] max-w-[90vw] max-h-[90vh] flex flex-col border border-border">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Create Environment</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-accent transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto space-y-4">
          {/* Environment Name */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Environment Name
            </label>
            <input
              type="text"
              value={envName}
              onChange={(e) => setEnvName(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="e.g., production, staging, local"
              autoFocus
            />
          </div>

          {/* Variables */}
          <div>
            <label className="text-sm font-medium mb-2 block">Variables</label>
            <div className="space-y-2">
              {variables.map((v) => (
                <div key={v.id} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={v.key}
                    onChange={(e) =>
                      handleVariableChange(v.id, "key", e.target.value)
                    }
                    className="flex-1 px-3 py-2 border border-input rounded-md bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="key"
                  />
                  <input
                    type="text"
                    value={v.value}
                    onChange={(e) =>
                      handleVariableChange(v.id, "value", e.target.value)
                    }
                    className="flex-[2] px-3 py-2 border border-input rounded-md bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="value"
                  />
                  <button
                    onClick={() => handleRemoveVariable(v.id)}
                    className="p-2 rounded hover:bg-accent transition-colors"
                    disabled={variables.length === 1}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={handleAddVariable}
              className="mt-2 flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <Plus className="h-4 w-4" />
              Add variable
            </button>
          </div>

          {/* Private checkbox */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="rounded border-input"
            />
            <Lock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              Save to private file (for secrets)
            </span>
          </label>

          {isPrivate && (
            <p className="text-xs text-muted-foreground">
              Private variables are stored in{" "}
              <code className="bg-muted px-1 rounded">
                http-client.private.env.json
              </code>
              . Add this file to your <code>.gitignore</code>.
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 hover:bg-accent rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !envName.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
