import { useState, useCallback } from "react";
import { X, Trash2, Pencil, Plus, Save, XCircle, Lock, Unlock } from "lucide-react";
import { useAppStore } from "@/stores/appStore";
import { useScriptStore } from "@/stores/scriptStore";
import { extractInlineVariables } from "@/lib/variables";
import { saveEnvironment } from "@/lib/tauri";

interface EnvironmentPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface EditableVariable {
  key: string;
  value: string;
  isNew?: boolean;
}

export function EnvironmentPanel({ isOpen, onClose }: EnvironmentPanelProps) {
  // All hooks must be called before any conditional returns
  const {
    environmentConfig,
    activeEnvironment,
    openFiles,
    activeFileIndex,
    workspacePath,
    loadEnvironments,
  } = useAppStore();

  const { responseVariables, clearAllVariables } = useScriptStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editedPublicVars, setEditedPublicVars] = useState<EditableVariable[]>([]);
  const [editedPrivateVars, setEditedPrivateVars] = useState<EditableVariable[]>([]);
  const [editedSharedVars, setEditedSharedVars] = useState<EditableVariable[]>([]);
  const [editedPrivateSharedVars, setEditedPrivateSharedVars] = useState<EditableVariable[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const startEditing = useCallback(() => {
    const env = environmentConfig?.environments.find(
      (e) => e.name === activeEnvironment
    );
    // Initialize with current variables - separate public and private
    setEditedPublicVars(
      Object.entries(env?.variables || {}).map(([key, value]) => ({ key, value }))
    );
    setEditedPrivateVars(
      Object.entries(env?.private_variables || {}).map(([key, value]) => ({ key, value }))
    );
    setEditedSharedVars(
      Object.entries(environmentConfig?.shared || {}).map(([key, value]) => ({ key, value }))
    );
    setEditedPrivateSharedVars(
      Object.entries(environmentConfig?.private_shared || {}).map(([key, value]) => ({ key, value }))
    );
    setIsEditing(true);
    setError("");
  }, [environmentConfig, activeEnvironment]);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setEditedPublicVars([]);
    setEditedPrivateVars([]);
    setEditedSharedVars([]);
    setEditedPrivateSharedVars([]);
    setError("");
  }, []);

  const handleSave = useCallback(async () => {
    if (!workspacePath || !activeEnvironment) return;

    setIsSaving(true);
    setError("");

    try {
      // Save public environment variables
      const publicVarsObj: Record<string, string> = {};
      for (const v of editedPublicVars) {
        if (v.key.trim()) {
          publicVarsObj[v.key.trim()] = v.value;
        }
      }
      await saveEnvironment(workspacePath, activeEnvironment, publicVarsObj, false);

      // Save private environment variables
      const privateVarsObj: Record<string, string> = {};
      for (const v of editedPrivateVars) {
        if (v.key.trim()) {
          privateVarsObj[v.key.trim()] = v.value;
        }
      }
      if (Object.keys(privateVarsObj).length > 0 || editedPrivateVars.length > 0) {
        await saveEnvironment(workspacePath, activeEnvironment, privateVarsObj, true);
      }

      // Save public shared variables
      const sharedVarsObj: Record<string, string> = {};
      for (const v of editedSharedVars) {
        if (v.key.trim()) {
          sharedVarsObj[v.key.trim()] = v.value;
        }
      }
      await saveEnvironment(workspacePath, "$shared", sharedVarsObj, false);

      // Save private shared variables
      const privateSharedVarsObj: Record<string, string> = {};
      for (const v of editedPrivateSharedVars) {
        if (v.key.trim()) {
          privateSharedVarsObj[v.key.trim()] = v.value;
        }
      }
      if (Object.keys(privateSharedVarsObj).length > 0 || editedPrivateSharedVars.length > 0) {
        await saveEnvironment(workspacePath, "$shared", privateSharedVarsObj, true);
      }

      await loadEnvironments();
      setIsEditing(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setIsSaving(false);
    }
  }, [workspacePath, activeEnvironment, editedPublicVars, editedPrivateVars, editedSharedVars, editedPrivateSharedVars, loadEnvironments]);

  // Early return AFTER all hooks are called
  if (!isOpen) return null;

  const env = environmentConfig?.environments.find(
    (e) => e.name === activeEnvironment
  );

  const hasResponseVars = Object.keys(responseVariables).length > 0;

  // Get inline variables from the active file
  const activeFile = activeFileIndex >= 0 ? openFiles[activeFileIndex] : null;
  const inlineVariables = activeFile ? extractInlineVariables(activeFile.content) : {};
  const hasInlineVars = Object.keys(inlineVariables).length > 0;

  const hasPublicEnvVars = Object.keys(env?.variables || {}).length > 0;
  const hasPrivateEnvVars = Object.keys(env?.private_variables || {}).length > 0;
  const hasEnvVars = hasPublicEnvVars || hasPrivateEnvVars || (isEditing && (editedPublicVars.length > 0 || editedPrivateVars.length > 0));

  const hasSharedVars = Object.keys(environmentConfig?.shared || {}).length > 0;
  const hasPrivateSharedVars = Object.keys(environmentConfig?.private_shared || {}).length > 0;
  const hasAnySharedVars = hasSharedVars || hasPrivateSharedVars || (isEditing && (editedSharedVars.length > 0 || editedPrivateSharedVars.length > 0));

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-card p-6 rounded-lg shadow-xl w-[650px] max-h-[85vh] overflow-hidden flex flex-col border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            Environment: {activeEnvironment || "None"}
          </h2>
          <div className="flex items-center gap-2">
            {!isEditing && env && (
              <button
                onClick={startEditing}
                className="p-1.5 rounded hover:bg-accent transition-colors"
                title="Edit variables"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-accent transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {env ? (
          <div className="text-xs text-muted-foreground mb-4 truncate">
            Source: {env.source_file}
          </div>
        ) : activeEnvironment ? (
          <div className="text-xs text-amber-500 mb-4">
            Environment "{activeEnvironment}" not found in config
          </div>
        ) : environmentConfig?.environments.length === 0 ? (
          <div className="text-xs text-muted-foreground mb-4">
            No environments loaded. Create an http-client.env.json file.
          </div>
        ) : null}

        {error && (
          <div className="text-xs text-destructive bg-destructive/10 p-2 rounded mb-4">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-auto">
          {!hasInlineVars && !hasEnvVars && !hasResponseVars && !hasAnySharedVars ? (
            <div className="text-center text-muted-foreground py-8">
              <p>No variables defined</p>
              <p className="text-xs mt-2">
                Create an <code className="bg-muted px-1 rounded">http-client.env.json</code> file
                in your workspace root, or use <code className="bg-muted px-1 rounded">@var = value</code> in your .http file.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Response Variables (from scripts) - read only */}
              {hasResponseVars && (
                <VariableSection
                  title="Response Variables"
                  subtitle="from scripts"
                  variables={Object.entries(responseVariables).map(([key, v]) => ({ key, value: formatResponseValue(v.value) }))}
                  color="text-orange-500"
                  onClear={clearAllVariables}
                />
              )}

              {/* Inline File Variables - read only */}
              {hasInlineVars && (
                <VariableSection
                  title="File Variables"
                  subtitle={activeFile?.name}
                  variables={Object.entries(inlineVariables).map(([key, value]) => ({ key, value }))}
                  color="text-green-500"
                />
              )}

              {/* Environment Variables - Public */}
              {(hasPublicEnvVars || (isEditing && editedPublicVars.length >= 0)) && (
                <EditableVariableSection
                  title="Environment Variables"
                  subtitle="public"
                  icon={<Unlock className="h-3.5 w-3.5" />}
                  variables={isEditing ? editedPublicVars : Object.entries(env?.variables || {}).map(([key, value]) => ({ key, value }))}
                  color="text-primary"
                  isEditing={isEditing}
                  onUpdate={(index, field, value) => {
                    setEditedPublicVars((vars) =>
                      vars.map((v, i) => (i === index ? { ...v, [field]: value } : v))
                    );
                  }}
                  onAdd={() => setEditedPublicVars((vars) => [...vars, { key: "", value: "", isNew: true }])}
                  onDelete={(index) => setEditedPublicVars((vars) => vars.filter((_, i) => i !== index))}
                />
              )}

              {/* Environment Variables - Private */}
              {(hasPrivateEnvVars || (isEditing && editedPrivateVars.length >= 0)) && (
                <EditableVariableSection
                  title="Environment Variables"
                  subtitle="private"
                  icon={<Lock className="h-3.5 w-3.5" />}
                  variables={isEditing ? editedPrivateVars : Object.entries(env?.private_variables || {}).map(([key, value]) => ({ key, value }))}
                  color="text-amber-500"
                  isEditing={isEditing}
                  onUpdate={(index, field, value) => {
                    setEditedPrivateVars((vars) =>
                      vars.map((v, i) => (i === index ? { ...v, [field]: value } : v))
                    );
                  }}
                  onAdd={() => setEditedPrivateVars((vars) => [...vars, { key: "", value: "", isNew: true }])}
                  onDelete={(index) => setEditedPrivateVars((vars) => vars.filter((_, i) => i !== index))}
                />
              )}

              {/* Shared Variables - Public */}
              {(hasSharedVars || (isEditing && editedSharedVars.length >= 0)) && (
                <EditableVariableSection
                  title="Shared Variables"
                  subtitle="public"
                  icon={<Unlock className="h-3.5 w-3.5" />}
                  variables={isEditing ? editedSharedVars : Object.entries(environmentConfig?.shared || {}).map(([key, value]) => ({ key, value }))}
                  color="text-muted-foreground"
                  isEditing={isEditing}
                  onUpdate={(index, field, value) => {
                    setEditedSharedVars((vars) =>
                      vars.map((v, i) => (i === index ? { ...v, [field]: value } : v))
                    );
                  }}
                  onAdd={() => setEditedSharedVars((vars) => [...vars, { key: "", value: "", isNew: true }])}
                  onDelete={(index) => setEditedSharedVars((vars) => vars.filter((_, i) => i !== index))}
                />
              )}

              {/* Shared Variables - Private */}
              {(hasPrivateSharedVars || (isEditing && editedPrivateSharedVars.length >= 0)) && (
                <EditableVariableSection
                  title="Shared Variables"
                  subtitle="private"
                  icon={<Lock className="h-3.5 w-3.5" />}
                  variables={isEditing ? editedPrivateSharedVars : Object.entries(environmentConfig?.private_shared || {}).map(([key, value]) => ({ key, value }))}
                  color="text-amber-500"
                  isEditing={isEditing}
                  onUpdate={(index, field, value) => {
                    setEditedPrivateSharedVars((vars) =>
                      vars.map((v, i) => (i === index ? { ...v, [field]: value } : v))
                    );
                  }}
                  onAdd={() => setEditedPrivateSharedVars((vars) => [...vars, { key: "", value: "", isNew: true }])}
                  onDelete={(index) => setEditedPrivateSharedVars((vars) => vars.filter((_, i) => i !== index))}
                />
              )}
            </div>
          )}
        </div>

        {/* Edit mode footer */}
        {isEditing && (
          <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border">
            <button
              onClick={cancelEditing}
              disabled={isSaving}
              className="flex items-center gap-1 px-3 py-1.5 hover:bg-accent rounded transition-colors"
            >
              <XCircle className="h-4 w-4" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Read-only variable section
function VariableSection({
  title,
  subtitle,
  variables,
  color,
  onClear,
}: {
  title: string;
  subtitle?: string;
  variables: { key: string; value: string }[];
  color: string;
  onClear?: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          {title}
          {subtitle && (
            <span className="text-xs font-normal opacity-70">({subtitle})</span>
          )}
        </h3>
        {onClear && (
          <button
            onClick={onClear}
            className="p-1 rounded hover:bg-accent transition-colors"
            title="Clear all"
          >
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>
      <table className="w-full text-sm">
        <tbody>
          {variables.map(({ key, value }) => (
            <tr key={key} className="border-b border-border/50 hover:bg-muted/30">
              <td className={`py-2 px-2 font-mono ${color}`}>{key}</td>
              <td className="py-2 px-2 font-mono truncate max-w-[250px]" title={value}>
                {maskSensitive(key, value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Editable variable section
function EditableVariableSection({
  title,
  subtitle,
  icon,
  variables,
  color,
  isEditing,
  onUpdate,
  onAdd,
  onDelete,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  variables: { key: string; value: string }[];
  color: string;
  isEditing: boolean;
  onUpdate: (index: number, field: "key" | "value", value: string) => void;
  onAdd: () => void;
  onDelete: (index: number) => void;
}) {
  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
        {icon}
        {title}
        {subtitle && (
          <span className="text-xs font-normal opacity-70">({subtitle})</span>
        )}
      </h3>
      {isEditing ? (
        <div className="space-y-2">
          {variables.map((v, index) => (
            <div key={index} className="flex gap-2 items-center">
              <input
                type="text"
                value={v.key}
                onChange={(e) => onUpdate(index, "key", e.target.value)}
                className="flex-1 px-2 py-1 border border-input rounded bg-background text-sm font-mono"
                placeholder="key"
              />
              <input
                type="text"
                value={v.value}
                onChange={(e) => onUpdate(index, "value", e.target.value)}
                className="flex-[2] px-2 py-1 border border-input rounded bg-background text-sm font-mono"
                placeholder="value"
              />
              <button
                onClick={() => onDelete(index)}
                className="p-1 rounded hover:bg-accent transition-colors"
                title="Delete variable"
              >
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          ))}
          <button
            onClick={onAdd}
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <Plus className="h-4 w-4" />
            Add variable
          </button>
        </div>
      ) : variables.length > 0 ? (
        <table className="w-full text-sm">
          <tbody>
            {variables.map(({ key, value }) => (
              <tr key={key} className="border-b border-border/50 hover:bg-muted/30">
                <td className={`py-2 px-2 font-mono ${color}`}>{key}</td>
                <td className="py-2 px-2 font-mono truncate max-w-[250px]" title={value}>
                  {maskSensitive(key, value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-xs text-muted-foreground italic">No variables</p>
      )}
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
