import { useState, useEffect } from "react";
import {
  FolderOpen,
  File,
  ChevronRight,
  ChevronDown,
  Plus,
  Settings,
  Moon,
  Sun,
  Loader2,
  AlertCircle,
  X,
  RefreshCw,
  Eye,
  History,
} from "lucide-react";
import { useAppStore, FileTreeItem, RequestTreeItem } from "@/stores/appStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { cn } from "@/lib/utils";
import { open } from "@tauri-apps/plugin-dialog";
import { isTauriAvailable } from "@/lib/tauri";
import { EnvironmentPanel } from "@/components/Environment/EnvironmentPanel";
import { Logo } from "@/components/Logo";

// Method colors for request badges
const METHOD_COLORS: Record<string, string> = {
  GET: "text-green-500",
  POST: "text-blue-500",
  PUT: "text-yellow-500",
  PATCH: "text-orange-500",
  DELETE: "text-red-500",
  HEAD: "text-purple-500",
  OPTIONS: "text-gray-500",
};

interface RequestTreeNodeProps {
  request: RequestTreeItem;
  depth: number;
  onClick: () => void;
  isActive?: boolean;
}

function RequestTreeNode({ request, depth, onClick, isActive }: RequestTreeNodeProps) {
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "flex items-center gap-2 px-2 py-1 cursor-pointer rounded-sm text-sm",
        "hover:bg-accent transition-colors",
        isActive && "bg-accent"
      )}
      style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
    >
      <span
        className={cn(
          "font-mono text-xs font-semibold flex-shrink-0 w-12",
          METHOD_COLORS[request.method] || "text-muted-foreground"
        )}
      >
        {request.method}
      </span>
      <span className="truncate text-muted-foreground" title={request.name}>
        {request.name}
      </span>
    </div>
  );
}

interface FileTreeNodeProps {
  item: FileTreeItem;
  depth: number;
}

function FileTreeNode({ item, depth }: FileTreeNodeProps) {
  const [folderExpanded, setFolderExpanded] = useState(true);
  const {
    loadFileFromPath,
    expandedHttpFiles,
    toggleHttpFileExpansion,
    parsedRequestsCache,
    setActiveRequestIndex,
    setActiveEditorView,
    setNavigateToLine,
    activeRequestIndex,
    openFiles,
    activeFileIndex,
  } = useAppStore();
  const { defaultEditorView } = useSettingsStore();

  const isHttpExpanded = item.isHttpFile && expandedHttpFiles.has(item.path);
  const requests = item.isHttpFile ? (parsedRequestsCache.get(item.path) || []) : [];

  // Check if this file is the active file to determine active request
  const activeFile = activeFileIndex >= 0 ? openFiles[activeFileIndex] : null;
  const isActiveFile = activeFile?.path === item.path;

  const handleClick = async () => {
    if (item.type === "folder") {
      setFolderExpanded(!folderExpanded);
    } else if (item.isHttpFile) {
      // Toggle expansion to show/hide requests
      await toggleHttpFileExpansion(item.path);
    } else {
      // Non-HTTP file: just open
      loadFileFromPath(item.path, item.name);
    }
  };

  const handleRequestClick = async (request: RequestTreeItem) => {
    // Load file if not already open
    await loadFileFromPath(item.path, item.name);
    // Set active request for GUI editing
    setActiveRequestIndex(request.parsedIndex);
    // Open in preferred view
    setActiveEditorView(defaultEditorView);
    // If source view, navigate to line
    if (defaultEditorView === 'source') {
      setNavigateToLine(request.lineNumber);
    }
  };

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent rounded-sm text-sm",
          "transition-colors"
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleClick}
      >
        {item.type === "folder" ? (
          <>
            {folderExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <FolderOpen className="h-4 w-4 text-yellow-500" />
          </>
        ) : item.isHttpFile ? (
          <>
            {isHttpExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <File className="h-4 w-4 text-green-500" />
          </>
        ) : (
          <>
            <span className="w-4" />
            <File className="h-4 w-4 text-muted-foreground" />
          </>
        )}
        <span className="truncate">{item.name}</span>
      </div>

      {/* Request children for expanded HTTP files */}
      {item.isHttpFile && isHttpExpanded && (
        <div>
          {requests.length > 0 ? (
            requests.map((request) => (
              <RequestTreeNode
                key={`${item.path}-${request.lineNumber}`}
                request={request}
                depth={depth + 1}
                onClick={() => handleRequestClick(request)}
                isActive={isActiveFile && activeRequestIndex === request.parsedIndex}
              />
            ))
          ) : (
            <div
              className="text-xs text-muted-foreground italic px-2 py-1"
              style={{ paddingLeft: `${(depth + 2) * 12 + 8}px` }}
            >
              No requests found
            </div>
          )}
        </div>
      )}

      {/* Folder children */}
      {item.type === "folder" && folderExpanded && item.children && (
        <div>
          {item.children.map((child) => (
            <FileTreeNode key={child.path} item={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const {
    workspacePath,
    activeEnvironment,
    setActiveEnvironment,
    environmentConfig,
    fileTree,
    isLoadingFiles,
    lastError,
    clearError,
    loadWorkspace,
    closeWorkspace,
    setShowHistoryPanel,
    setShowSettingsPanel,
  } = useAppStore();

  const { theme, setSetting, getResolvedTheme } = useSettingsStore();
  const isDarkMode = getResolvedTheme() === 'dark';

  const toggleTheme = () => {
    // Cycle through: dark -> light -> system -> dark
    if (theme === 'dark') {
      setSetting('theme', 'light');
    } else if (theme === 'light') {
      setSetting('theme', 'system');
    } else {
      setSetting('theme', 'dark');
    }
  };

  // Get environments from config
  const environments = environmentConfig?.environments || [];

  // State for environment panel
  const [showEnvPanel, setShowEnvPanel] = useState(false);

  // Extract workspace name from path
  const workspaceName = workspacePath?.split("/").pop() || null;

  // Load workspace when path is set (e.g., from persisted state)
  useEffect(() => {
    if (workspacePath && fileTree.length === 0 && !isLoadingFiles && isTauriAvailable()) {
      loadWorkspace(workspacePath);
    }
  }, [workspacePath, fileTree.length, isLoadingFiles, loadWorkspace]);

  const handleOpenFolder = async () => {
    if (!isTauriAvailable()) {
      console.warn("Not running in Tauri context");
      return;
    }
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Open Workspace",
      });
      if (selected && typeof selected === "string") {
        loadWorkspace(selected);
      }
    } catch (error) {
      console.error("Failed to open folder:", error);
    }
  };

  const handleRefresh = () => {
    if (workspacePath && !isLoadingFiles) {
      loadWorkspace(workspacePath);
    }
  };

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Header */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size={24} />
            <h1 className="font-semibold text-lg">Kvile</h1>
          </div>
          <div className="flex items-center gap-1">
            {workspacePath && (
              <button
                onClick={() => setShowHistoryPanel(true)}
                className="p-1.5 rounded hover:bg-accent transition-colors"
                title="Request History (Ctrl+H)"
              >
                <History className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded hover:bg-accent transition-colors"
              title={`Theme: ${theme} (click to cycle)`}
            >
              {isDarkMode ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={() => setShowSettingsPanel(true)}
              className="p-1.5 rounded hover:bg-accent transition-colors"
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Environment Selector */}
      <div className="p-2 border-b border-border">
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-muted-foreground">Environment</label>
          {environments.length > 0 && (
            <button
              onClick={() => setShowEnvPanel(true)}
              className="p-1 rounded hover:bg-accent transition-colors"
              title="View variables"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <select
          value={activeEnvironment}
          onChange={(e) => setActiveEnvironment(e.target.value)}
          className="w-full px-2 py-1.5 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
          disabled={environments.length === 0}
        >
          {environments.length === 0 ? (
            <option value="">No environments</option>
          ) : (
            environments.map((env) => (
              <option key={env.name} value={env.name}>
                {env.name}
              </option>
            ))
          )}
        </select>
      </div>

      {/* Workspace Name */}
      {workspaceName && (
        <div className="flex items-center justify-between p-2 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2 min-w-0">
            <FolderOpen className="h-4 w-4 text-yellow-500 flex-shrink-0" />
            <span className="text-sm font-medium truncate" title={workspacePath || ""}>
              {workspaceName}
            </span>
          </div>
          <button
            onClick={closeWorkspace}
            className="p-1 rounded hover:bg-accent transition-colors flex-shrink-0"
            title="Close workspace"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* File Tree */}
      <div className="flex-1 overflow-auto p-2">
        <div className="flex items-center justify-between mb-2 px-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Collections
          </span>
          <div className="flex items-center gap-1">
            {workspacePath && (
              <button
                className={cn(
                  "p-1 rounded hover:bg-accent transition-colors",
                  isLoadingFiles && "animate-spin"
                )}
                title="Refresh"
                onClick={handleRefresh}
                disabled={isLoadingFiles}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              className="p-1 rounded hover:bg-accent transition-colors"
              title="Open folder"
              onClick={handleOpenFolder}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Error message */}
        {lastError && (
          <div className="mb-2 p-2 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive flex items-start gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p>{lastError}</p>
              <button
                onClick={clearError}
                className="text-xs underline hover:no-underline mt-1"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Loading state - only show when loading workspace and no files yet */}
        {isLoadingFiles && fileTree.length === 0 && (
          <div className="flex items-center justify-center py-4 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            <span className="text-sm">Loading files...</span>
          </div>
        )}

        {/* File tree content - always show if we have files */}
        {workspacePath && fileTree.length > 0 && (
          <div className="space-y-0.5">
            {fileTree.map((item) => (
              <FileTreeNode key={item.path} item={item} depth={0} />
            ))}
          </div>
        )}

        {/* Empty workspace state */}
        {!isLoadingFiles && workspacePath && fileTree.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No .http files found</p>
            <p className="text-xs mt-1">Create a .http file to get started</p>
          </div>
        )}

        {/* No workspace state */}
        {!workspacePath && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No folder open</p>
            <button
              onClick={handleOpenFolder}
              className="mt-2 text-primary hover:underline"
            >
              Open a folder
            </button>
          </div>
        )}
      </div>

      {/* Environment Panel */}
      <EnvironmentPanel
        isOpen={showEnvPanel}
        onClose={() => setShowEnvPanel(false)}
      />
    </div>
  );
}
