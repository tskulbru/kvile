import { create } from "zustand";
import { persist } from "zustand/middleware";
import * as tauri from "@/lib/tauri";
import { extractInlineVariables } from "@/lib/variables";
import type {
  FileInfo,
  HttpRequest as TauriHttpRequest,
  ParsedRequest,
  EnvironmentConfig,
  HistoryEntry,
} from "@/lib/tauri";

export interface HttpFile {
  path: string;
  name: string;
  content: string;
  modified: boolean;
  parsedRequests: ParsedRequest[];
}

export interface HttpRequest {
  id: string;
  name?: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  lineNumber: number;
}

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  time: number;
  size: number;
  timestamp: Date;
}

export interface FileTreeItem {
  name: string;
  path: string;
  type: "file" | "folder";
  isHttpFile: boolean;
  children?: FileTreeItem[];
}

export interface RunAllResultItem {
  request: ParsedRequest;
  response?: HttpResponse;
  error?: string;
  duration: number;
}

export interface RunAllResult {
  total: number;
  successful: number;
  failed: number;
  results: RunAllResultItem[];
}

export interface RequestTreeItem {
  name: string;       // Request name or URL path
  method: string;     // GET, POST, etc.
  lineNumber: number; // For source navigation
  parsedIndex: number; // Index in parsedRequests array
}

interface AppState {
  // Theme
  isDarkMode: boolean;
  toggleDarkMode: () => void;

  // Files
  openFiles: HttpFile[];
  activeFileIndex: number;
  setActiveFileIndex: (index: number) => void;
  openFile: (file: HttpFile) => void;
  closeFile: (index: number, force?: boolean) => void;
  updateFileContent: (index: number, content: string) => void;
  updateFileParsedRequests: (index: number, requests: ParsedRequest[]) => void;

  // Pending close (for unsaved changes confirmation)
  pendingCloseIndex: number | null;
  setPendingCloseIndex: (index: number | null) => void;
  confirmCloseFile: (save: boolean) => Promise<void>;

  // Editor cursor position
  cursorLine: number;
  setCursorLine: (line: number) => void;

  // Navigation (for clicking on requests to navigate)
  navigateToLine: number | null;
  setNavigateToLine: (line: number | null) => void;

  // Current request/response
  currentRequest: HttpRequest | null;
  setCurrentRequest: (request: HttpRequest | null) => void;
  currentResponse: HttpResponse | null;
  setCurrentResponse: (response: HttpResponse | null) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  // Environment
  environmentConfig: EnvironmentConfig | null;
  activeEnvironment: string;
  setActiveEnvironment: (name: string) => void;
  loadEnvironments: () => Promise<void>;
  getCurrentVariables: () => Record<string, string>;

  // Workspace
  workspacePath: string | null;
  setWorkspacePath: (path: string | null) => void;
  closeWorkspace: () => void;

  // File tree
  fileTree: FileTreeItem[];
  setFileTree: (tree: FileTreeItem[]) => void;

  // Loading states
  isLoadingFiles: boolean;
  isExecutingRequest: boolean;
  isSavingFile: boolean;

  // Error state
  lastError: string | null;
  clearError: () => void;
  setError: (error: string | null) => void;

  // Async actions
  loadWorkspace: (path: string) => Promise<void>;
  refreshWorkspace: () => Promise<void>;
  loadFileFromPath: (path: string, name: string) => Promise<void>;
  executeRequest: (request: TauriHttpRequest) => Promise<void>;
  saveCurrentFile: () => Promise<void>;
  saveAllFiles: () => Promise<void>;
  discardFileChanges: (index?: number) => Promise<void>;

  // Run all requests
  runAllResults: RunAllResult | null;
  isRunningAll: boolean;
  runAllProgress: number;
  executeAllRequests: (stopOnError?: boolean) => Promise<void>;
  cancelRunAll: () => void;
  clearRunAllResults: () => void;

  // UI State
  sidebarVisible: boolean;
  toggleSidebar: () => void;
  showShortcutsPanel: boolean;
  setShowShortcutsPanel: (show: boolean) => void;
  showCommandPalette: boolean;
  setShowCommandPalette: (show: boolean) => void;
  showHistoryPanel: boolean;
  setShowHistoryPanel: (show: boolean) => void;
  historyCompareMode: boolean;
  openHistoryForCompare: () => void;
  showCurlImport: boolean;
  setShowCurlImport: (show: boolean) => void;
  showSettingsPanel: boolean;
  setShowSettingsPanel: (show: boolean) => void;

  // Diff/Compare
  showDiffPanel: boolean;
  setShowDiffPanel: (show: boolean) => void;
  diffLeftResponse: HttpResponse | null;
  diffRightResponse: HttpResponse | null;
  setDiffResponses: (left: HttpResponse | null, right: HttpResponse | null) => void;
  compareWithCurrent: (entry: HistoryEntry) => void;

  // Editor View (GUI vs Source)
  activeEditorView: 'gui' | 'source';
  setActiveEditorView: (view: 'gui' | 'source') => void;
  activeRequestIndex: number | null;
  setActiveRequestIndex: (index: number | null) => void;

  // Lazy parsing cache for sidebar request expansion
  parsedRequestsCache: Map<string, RequestTreeItem[]>;
  expandedHttpFiles: Set<string>;
  toggleHttpFileExpansion: (path: string) => Promise<void>;
  clearParsedRequestsCache: (path?: string) => void;

  // History
  historyEntries: HistoryEntry[];
  isLoadingHistory: boolean;
  loadHistory: () => Promise<void>;
  deleteHistoryEntry: (id: number) => Promise<void>;
  clearHistory: () => Promise<void>;
  viewHistoryEntry: (entry: HistoryEntry) => Promise<void>;
  rerunHistoryEntry: (entry: HistoryEntry) => Promise<void>;
}

/**
 * Check if a file is relevant for the file tree
 */
function isRelevantFile(name: string): boolean {
  const lowerName = name.toLowerCase();
  return (
    lowerName.endsWith(".http") ||
    lowerName.endsWith(".rest") ||
    lowerName.includes(".env.json") ||
    lowerName === "http-client.env.json"
  );
}

/**
 * Recursively prune empty folders from the tree
 */
function pruneEmptyFolders(items: FileTreeItem[]): FileTreeItem[] {
  return items
    .map((item) => {
      if (item.type === "folder" && item.children) {
        const prunedChildren = pruneEmptyFolders(item.children);
        if (prunedChildren.length === 0) {
          return null; // Remove empty folder
        }
        return { ...item, children: prunedChildren };
      }
      return item;
    })
    .filter((item): item is FileTreeItem => item !== null);
}

/**
 * Sort tree: folders first, then files, alphabetically
 */
function sortTree(items: FileTreeItem[]): FileTreeItem[] {
  return items
    .map((item) => {
      if (item.type === "folder" && item.children) {
        return { ...item, children: sortTree(item.children) };
      }
      return item;
    })
    .sort((a, b) => {
      // Folders first
      if (a.type === "folder" && b.type !== "folder") return -1;
      if (a.type !== "folder" && b.type === "folder") return 1;
      // Then alphabetically
      return a.name.localeCompare(b.name);
    });
}

/**
 * Build a file tree structure from a flat list of FileInfo
 */
function buildFileTree(files: FileInfo[], basePath: string): FileTreeItem[] {
  const tree: FileTreeItem[] = [];
  const folderMap = new Map<string, FileTreeItem>();

  // Filter to only relevant files and sort
  const relevantFiles = files
    .filter((f) => isRelevantFile(f.name))
    .sort((a, b) => a.path.localeCompare(b.path));

  for (const file of relevantFiles) {
    // Get relative path from basePath
    const relativePath = file.path.startsWith(basePath)
      ? file.path.slice(basePath.length).replace(/^\//, "")
      : file.path;
    const parts = relativePath.split("/").filter(Boolean);

    if (parts.length === 0) continue;

    let currentLevel = tree;
    let currentPath = basePath;

    // Create folder structure
    for (let i = 0; i < parts.length - 1; i++) {
      currentPath = currentPath + "/" + parts[i];
      let folder = folderMap.get(currentPath);

      if (!folder) {
        folder = {
          name: parts[i],
          path: currentPath,
          type: "folder",
          isHttpFile: false,
          children: [],
        };
        folderMap.set(currentPath, folder);
        currentLevel.push(folder);
      }

      currentLevel = folder.children!;
    }

    // Add the file
    currentLevel.push({
      name: file.name,
      path: file.path,
      type: "file",
      isHttpFile: file.is_http_file,
    });
  }

  // Prune empty folders and sort
  return sortTree(pruneEmptyFolders(tree));
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Theme
      isDarkMode: true,
      toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),

      // Files
      openFiles: [],
      activeFileIndex: -1,
      setActiveFileIndex: (index) => set({ activeFileIndex: index }),
      openFile: (file) => {
        const { openFiles } = get();
        const existingIndex = openFiles.findIndex((f) => f.path === file.path);
        if (existingIndex >= 0) {
          set({ activeFileIndex: existingIndex });
        } else {
          // Ensure file has parsedRequests (may be empty if not parsed yet)
          const fileWithRequests: HttpFile = {
            ...file,
            parsedRequests: file.parsedRequests || [],
          };
          set({
            openFiles: [...openFiles, fileWithRequests],
            activeFileIndex: openFiles.length,
          });
        }
      },
      closeFile: (index, force = false) => {
        const { openFiles, activeFileIndex } = get();
        const file = openFiles[index];

        // If file is modified and not forced, show confirmation
        if (file?.modified && !force) {
          set({ pendingCloseIndex: index });
          return;
        }

        // Actually close the file
        const newFiles = openFiles.filter((_, i) => i !== index);
        let newActiveIndex = activeFileIndex;
        if (index === activeFileIndex) {
          newActiveIndex = Math.min(activeFileIndex, newFiles.length - 1);
        } else if (index < activeFileIndex) {
          newActiveIndex = activeFileIndex - 1;
        }
        set({ openFiles: newFiles, activeFileIndex: newActiveIndex, pendingCloseIndex: null });
      },
      updateFileContent: (index, content) => {
        const { openFiles } = get();
        const newFiles = [...openFiles];
        newFiles[index] = { ...newFiles[index], content, modified: true };
        set({ openFiles: newFiles });
        // Note: Don't clear cache here - let updateFileParsedRequests handle it
      },
      updateFileParsedRequests: (index, requests) => {
        const { openFiles, parsedRequestsCache, expandedHttpFiles } = get();
        const file = openFiles[index];
        const newFiles = [...openFiles];
        newFiles[index] = { ...newFiles[index], parsedRequests: requests };
        set({ openFiles: newFiles });

        // Also update the sidebar cache if this file is expanded
        if (file && expandedHttpFiles.has(file.path)) {
          const requestItems: RequestTreeItem[] = requests.map((req, idx) => ({
            name: req.name || req.url.replace(/^https?:\/\/[^/]+/, '') || req.url,
            method: req.method,
            lineNumber: req.line_number,
            parsedIndex: idx,
          }));
          const newCache = new Map(parsedRequestsCache);
          newCache.set(file.path, requestItems);
          set({ parsedRequestsCache: newCache });
        }
      },

      // Pending close
      pendingCloseIndex: null,
      setPendingCloseIndex: (index) => set({ pendingCloseIndex: index }),
      confirmCloseFile: async (save) => {
        const { pendingCloseIndex, openFiles, closeFile } = get();
        if (pendingCloseIndex === null) return;

        const file = openFiles[pendingCloseIndex];
        if (!file) {
          set({ pendingCloseIndex: null });
          return;
        }

        if (save) {
          // Save the file first
          try {
            await tauri.writeFile(file.path, file.content);
            // Update modified flag
            const newFiles = [...openFiles];
            newFiles[pendingCloseIndex] = { ...file, modified: false };
            set({ openFiles: newFiles });
          } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to save file";
            set({ lastError: message, pendingCloseIndex: null });
            return;
          }
        }

        // Close the file (force since we've handled save already or user chose discard)
        closeFile(pendingCloseIndex, true);
      },

      // Editor cursor position
      cursorLine: 1,
      setCursorLine: (line) => set({ cursorLine: line }),

      // Navigation
      navigateToLine: null,
      setNavigateToLine: (line) => set({ navigateToLine: line }),

      // Current request/response
      currentRequest: null,
      setCurrentRequest: (request) => set({ currentRequest: request }),
      currentResponse: null,
      setCurrentResponse: (response) => set({ currentResponse: response }),
      isLoading: false,
      setIsLoading: (loading) => set({ isLoading: loading }),

      // Environment
      environmentConfig: null,
      activeEnvironment: "",
      setActiveEnvironment: (name) => set({ activeEnvironment: name }),
      loadEnvironments: async () => {
        const { workspacePath } = get();
        if (!workspacePath) return;

        try {
          const config = await tauri.loadEnvironmentConfig(workspacePath);
          set({ environmentConfig: config });

          // Auto-select first environment if none selected or current doesn't exist
          const { activeEnvironment } = get();
          const envExists = config.environments.some((e) => e.name === activeEnvironment);
          if (config.environments.length > 0 && (!activeEnvironment || !envExists)) {
            set({ activeEnvironment: config.environments[0].name });
          }
        } catch (error) {
          console.warn("Failed to load environments:", error);
        }
      },
      getCurrentVariables: () => {
        const { environmentConfig, activeEnvironment } = get();
        if (!environmentConfig) return {};

        const env = environmentConfig.environments.find(
          (e) => e.name === activeEnvironment
        );

        return {
          ...environmentConfig.shared,
          ...(env?.variables || {}),
        };
      },

      // Workspace
      workspacePath: null,
      setWorkspacePath: (path) => set({ workspacePath: path }),
      closeWorkspace: () => {
        // Stop watching for file changes
        tauri.stopWatching().catch(console.warn);
        set({
          workspacePath: null,
          fileTree: [],
          openFiles: [],
          activeFileIndex: -1,
          currentResponse: null,
          environmentConfig: null,
          activeEnvironment: "",
        });
      },

      // File tree
      fileTree: [],
      setFileTree: (tree) => set({ fileTree: tree }),

      // Loading states
      isLoadingFiles: false,
      isExecutingRequest: false,
      isSavingFile: false,

      // Error state
      lastError: null,
      clearError: () => set({ lastError: null }),
      setError: (error) => set({ lastError: error }),

      // Async actions
      loadWorkspace: async (path: string) => {
        set({ isLoadingFiles: true, lastError: null });
        try {
          const files = await tauri.listHttpFiles(path);
          const tree = buildFileTree(files, path);
          set({ workspacePath: path, fileTree: tree, isLoadingFiles: false });

          // Load environment configuration
          await get().loadEnvironments();

          // Start watching for file changes
          try {
            await tauri.startWatching(path);
          } catch (watchError) {
            console.warn("Failed to start file watcher:", watchError);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to load workspace";
          set({ lastError: message, isLoadingFiles: false });
        }
      },

      refreshWorkspace: async () => {
        const { workspacePath, isLoadingFiles } = get();
        if (!workspacePath || isLoadingFiles) return;

        set({ isLoadingFiles: true });
        try {
          const files = await tauri.listHttpFiles(workspacePath);
          const tree = buildFileTree(files, workspacePath);
          set({ fileTree: tree, isLoadingFiles: false });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to refresh workspace";
          set({ lastError: message, isLoadingFiles: false });
        }
      },

      loadFileFromPath: async (path: string, name: string) => {
        // Check if file is already open - just switch to it without reloading
        const { openFiles } = get();
        const existingIndex = openFiles.findIndex((f) => f.path === path);
        if (existingIndex >= 0) {
          set({ activeFileIndex: existingIndex });
          return;
        }

        // File not open yet, load it
        // Note: We don't set isLoadingFiles here to avoid sidebar flickering
        // The file tree is already loaded, we're just opening a single file
        set({ lastError: null });
        try {
          const content = await tauri.readFile(path);
          // Parse the file content to extract requests
          let parsedRequests: ParsedRequest[] = [];
          try {
            parsedRequests = await tauri.parseHttpFile(content);
          } catch (parseError) {
            console.warn("Failed to parse HTTP file:", parseError);
          }
          const { openFile } = get();
          openFile({ path, name, content, modified: false, parsedRequests });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to load file";
          set({ lastError: message });
        }
      },

      executeRequest: async (request: TauriHttpRequest) => {
        const { workspacePath, openFiles, activeFileIndex } = get();
        const activeFile = activeFileIndex >= 0 ? openFiles[activeFileIndex] : null;

        set({ isExecutingRequest: true, isLoading: true, lastError: null });
        try {
          const response = await tauri.sendRequest(request);
          set({
            currentResponse: {
              status: response.status,
              statusText: response.status_text,
              headers: response.headers,
              body: response.body,
              time: response.time,
              size: response.size,
              timestamp: new Date(),
            },
            // Store the executed request so we can use its URL for filtering history comparisons
            currentRequest: {
              id: `${Date.now()}`,
              method: request.method,
              url: request.url,
              headers: request.headers,
              body: request.body,
              lineNumber: 0,
            },
            isExecutingRequest: false,
            isLoading: false,
          });

          // Auto-save to history if workspace is open
          if (workspacePath) {
            try {
              await tauri.addHistoryEntry({
                workspace: workspacePath,
                file_path: activeFile?.path,
                request_name: undefined, // Could extract from parsed request name
                method: request.method,
                url: request.url,
                request_headers: JSON.stringify(request.headers),
                request_body: request.body,
                status: response.status,
                status_text: response.status_text,
                response_headers: JSON.stringify(response.headers),
                response_body: response.body,
                duration_ms: response.time,
                response_size: response.size,
              });
            } catch (historyError) {
              // Don't fail the request if history save fails
              console.warn("Failed to save to history:", historyError);
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Request failed";
          set({ lastError: message, isExecutingRequest: false, isLoading: false });
        }
      },

      saveCurrentFile: async () => {
        const { openFiles, activeFileIndex } = get();
        const activeFile = openFiles[activeFileIndex];
        if (!activeFile) return;

        set({ isSavingFile: true, lastError: null });
        try {
          await tauri.writeFile(activeFile.path, activeFile.content);
          const newFiles = [...openFiles];
          newFiles[activeFileIndex] = { ...activeFile, modified: false };
          set({ openFiles: newFiles, isSavingFile: false });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to save file";
          set({ lastError: message, isSavingFile: false });
        }
      },

      saveAllFiles: async () => {
        const { openFiles } = get();
        const modifiedFiles = openFiles.filter((f) => f.modified);
        if (modifiedFiles.length === 0) return;

        set({ isSavingFile: true, lastError: null });
        try {
          const newFiles = [...openFiles];
          for (let i = 0; i < openFiles.length; i++) {
            if (openFiles[i].modified) {
              await tauri.writeFile(openFiles[i].path, openFiles[i].content);
              newFiles[i] = { ...openFiles[i], modified: false };
            }
          }
          set({ openFiles: newFiles, isSavingFile: false });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to save files";
          set({ lastError: message, isSavingFile: false });
        }
      },

      discardFileChanges: async (index?: number) => {
        const { openFiles, activeFileIndex, expandedHttpFiles, parsedRequestsCache } = get();
        const targetIndex = index ?? activeFileIndex;
        const file = openFiles[targetIndex];
        if (!file || !file.modified) return;

        set({ lastError: null });
        try {
          // Reload file content from disk
          const content = await tauri.readFile(file.path);
          // Re-parse the file
          let parsedRequests: ParsedRequest[] = [];
          try {
            parsedRequests = await tauri.parseHttpFile(content);
          } catch (parseError) {
            console.warn("Failed to parse HTTP file:", parseError);
          }

          // Update the file in openFiles
          const newFiles = [...openFiles];
          newFiles[targetIndex] = {
            ...file,
            content,
            modified: false,
            parsedRequests,
          };
          set({ openFiles: newFiles });

          // Update sidebar cache if file is expanded
          if (expandedHttpFiles.has(file.path)) {
            const requestItems: RequestTreeItem[] = parsedRequests.map((req, idx) => ({
              name: req.name || req.url.replace(/^https?:\/\/[^/]+/, '') || req.url,
              method: req.method,
              lineNumber: req.line_number,
              parsedIndex: idx,
            }));
            const newCache = new Map(parsedRequestsCache);
            newCache.set(file.path, requestItems);
            set({ parsedRequestsCache: newCache });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to discard changes";
          set({ lastError: message });
        }
      },

      // Run all requests
      runAllResults: null,
      isRunningAll: false,
      runAllProgress: 0,

      executeAllRequests: async (stopOnError = false) => {
        const { openFiles, activeFileIndex, getCurrentVariables, workspacePath } = get();
        const file = openFiles[activeFileIndex];

        if (!file?.parsedRequests?.length) {
          set({ lastError: "No requests to run" });
          return;
        }

        const requests = file.parsedRequests;
        // Get all variables: environment + inline from file content
        const envVariables = getCurrentVariables();
        const inlineVariables = extractInlineVariables(file.content);
        const variables = { ...envVariables, ...inlineVariables };
        const results: RunAllResultItem[] = [];

        set({
          isRunningAll: true,
          runAllProgress: 0,
          runAllResults: null,
          lastError: null,
        });

        for (let i = 0; i < requests.length; i++) {
          // Check if cancelled
          if (!get().isRunningAll) break;

          const request = requests[i];
          const startTime = Date.now();

          try {
            // Substitute variables
            const varRegex = /\{\{([\w.-]+)\}\}/g;
            const substitute = (str: string) =>
              str.replace(varRegex, (match, varName) =>
                varName in variables ? variables[varName] : match
              );

            const substitutedUrl = substitute(request.url);
            const substitutedHeaders = Object.fromEntries(
              Object.entries(request.headers).map(([k, v]) => [k, substitute(v)])
            );
            const substitutedBody = request.body ? substitute(request.body) : undefined;

            const response = await tauri.sendRequest({
              method: request.method,
              url: substitutedUrl,
              headers: substitutedHeaders,
              body: substitutedBody,
            });

            results.push({
              request,
              response: {
                status: response.status,
                statusText: response.status_text,
                headers: response.headers,
                body: response.body,
                time: response.time,
                size: response.size,
                timestamp: new Date(),
              },
              duration: Date.now() - startTime,
            });

            // Save to history
            if (workspacePath) {
              try {
                await tauri.addHistoryEntry({
                  workspace: workspacePath,
                  file_path: file.path,
                  request_name: request.name,
                  method: request.method,
                  url: substitutedUrl,
                  request_headers: JSON.stringify(substitutedHeaders),
                  request_body: substitutedBody,
                  status: response.status,
                  status_text: response.status_text,
                  response_headers: JSON.stringify(response.headers),
                  response_body: response.body,
                  duration_ms: response.time,
                  response_size: response.size,
                });
              } catch (historyError) {
                console.warn("Failed to save to history:", historyError);
              }
            }
          } catch (error) {
            results.push({
              request,
              error: error instanceof Error ? error.message : String(error),
              duration: Date.now() - startTime,
            });

            if (stopOnError) break;
          }

          set({ runAllProgress: ((i + 1) / requests.length) * 100 });
        }

        const successful = results.filter((r) => r.response).length;

        set({
          isRunningAll: false,
          runAllResults: {
            total: requests.length,
            successful,
            failed: results.length - successful,
            results,
          },
        });
      },

      cancelRunAll: () => {
        set({ isRunningAll: false });
      },

      clearRunAllResults: () => {
        set({ runAllResults: null });
      },

      // UI State
      sidebarVisible: true,
      toggleSidebar: () => {
        set((state) => ({ sidebarVisible: !state.sidebarVisible }));
      },
      showShortcutsPanel: false,
      setShowShortcutsPanel: (show: boolean) => {
        set({ showShortcutsPanel: show });
      },
      showCommandPalette: false,
      setShowCommandPalette: (show: boolean) => {
        set({ showCommandPalette: show });
      },
      showHistoryPanel: false,
      setShowHistoryPanel: (show: boolean) => {
        set({ showHistoryPanel: show, historyCompareMode: false });
        // Auto-load history when panel opens
        if (show) {
          get().loadHistory();
        }
      },
      historyCompareMode: false,
      openHistoryForCompare: () => {
        set({ showHistoryPanel: true, historyCompareMode: true });
        get().loadHistory();
      },
      showCurlImport: false,
      setShowCurlImport: (show: boolean) => {
        set({ showCurlImport: show });
      },
      showSettingsPanel: false,
      setShowSettingsPanel: (show: boolean) => {
        set({ showSettingsPanel: show });
      },

      // Diff/Compare
      showDiffPanel: false,
      setShowDiffPanel: (show: boolean) => {
        set({ showDiffPanel: show });
      },
      diffLeftResponse: null,
      diffRightResponse: null,
      setDiffResponses: (left, right) => {
        set({ diffLeftResponse: left, diffRightResponse: right });
      },
      compareWithCurrent: (entry: HistoryEntry) => {
        const { currentResponse } = get();
        if (!currentResponse) return;

        // Convert history entry to HttpResponse
        const historyResponse: HttpResponse = {
          status: entry.status,
          statusText: entry.status_text,
          headers: JSON.parse(entry.response_headers),
          body: entry.response_body,
          time: entry.duration_ms,
          size: entry.response_size,
          timestamp: new Date(entry.timestamp),
        };

        set({
          diffLeftResponse: historyResponse,
          diffRightResponse: currentResponse,
          showDiffPanel: true,
          showHistoryPanel: false,
        });
      },

      // Editor View (GUI vs Source)
      activeEditorView: 'source' as const,
      setActiveEditorView: (view) => set({ activeEditorView: view }),
      activeRequestIndex: null,
      setActiveRequestIndex: (index) => set({ activeRequestIndex: index }),

      // Lazy parsing cache for sidebar request expansion
      parsedRequestsCache: new Map<string, RequestTreeItem[]>(),
      expandedHttpFiles: new Set<string>(),

      toggleHttpFileExpansion: async (path: string) => {
        const { expandedHttpFiles, parsedRequestsCache } = get();
        const newExpanded = new Set(expandedHttpFiles);

        if (newExpanded.has(path)) {
          // Collapse
          newExpanded.delete(path);
          set({ expandedHttpFiles: newExpanded });
        } else {
          // Expand - need to parse if not cached
          if (!parsedRequestsCache.has(path)) {
            try {
              const content = await tauri.readFile(path);
              const parsedRequests = await tauri.parseHttpFile(content);

              // Convert ParsedRequest[] to RequestTreeItem[]
              const requestItems: RequestTreeItem[] = parsedRequests.map((req, idx) => ({
                name: req.name || req.url.replace(/^https?:\/\/[^/]+/, '') || req.url,
                method: req.method,
                lineNumber: req.line_number,
                parsedIndex: idx,
              }));

              const newCache = new Map(parsedRequestsCache);
              newCache.set(path, requestItems);
              set({ parsedRequestsCache: newCache });
            } catch (error) {
              console.warn("Failed to parse HTTP file for tree:", error);
              // Still expand even if parse fails - will show empty
              const newCache = new Map(parsedRequestsCache);
              newCache.set(path, []);
              set({ parsedRequestsCache: newCache });
            }
          }

          newExpanded.add(path);
          set({ expandedHttpFiles: newExpanded });
        }
      },

      clearParsedRequestsCache: (path?: string) => {
        const { parsedRequestsCache } = get();
        if (path) {
          const newCache = new Map(parsedRequestsCache);
          newCache.delete(path);
          set({ parsedRequestsCache: newCache });
        } else {
          set({ parsedRequestsCache: new Map() });
        }
      },

      // History
      historyEntries: [],
      isLoadingHistory: false,

      loadHistory: async () => {
        const { workspacePath } = get();
        if (!workspacePath) return;

        set({ isLoadingHistory: true });
        try {
          const entries = await tauri.getHistory(workspacePath, 100);
          set({ historyEntries: entries, isLoadingHistory: false });
        } catch (error) {
          console.error("Failed to load history:", error);
          set({ isLoadingHistory: false });
        }
      },

      deleteHistoryEntry: async (id: number) => {
        try {
          await tauri.deleteHistoryEntry(id);
          // Remove from local state
          set((state) => ({
            historyEntries: state.historyEntries.filter((e) => e.id !== id),
          }));
        } catch (error) {
          console.error("Failed to delete history entry:", error);
        }
      },

      clearHistory: async () => {
        const { workspacePath } = get();
        if (!workspacePath) return;

        try {
          await tauri.clearHistory(workspacePath);
          set({ historyEntries: [] });
        } catch (error) {
          console.error("Failed to clear history:", error);
        }
      },

      viewHistoryEntry: async (entry: HistoryEntry) => {
        // If the entry has a file path and no file is currently open (or a different file),
        // open the associated file first
        const { openFiles, activeFileIndex, loadFileFromPath } = get();
        const activeFile = activeFileIndex >= 0 ? openFiles[activeFileIndex] : null;

        if (entry.file_path && (!activeFile || activeFile.path !== entry.file_path)) {
          // Extract filename from path
          const fileName = entry.file_path.split('/').pop() || entry.file_path;
          await loadFileFromPath(entry.file_path, fileName);
        }

        // Parse the stored response and set it as current
        const response: HttpResponse = {
          status: entry.status,
          statusText: entry.status_text,
          headers: JSON.parse(entry.response_headers),
          body: entry.response_body,
          time: entry.duration_ms,
          size: entry.response_size,
          timestamp: new Date(entry.timestamp),
        };

        // Also set current request from history entry for compare filtering
        const request: HttpRequest = {
          id: `history-${entry.id}`,
          method: entry.method,
          url: entry.url,
          headers: JSON.parse(entry.request_headers),
          body: entry.request_body,
          lineNumber: 0,
        };

        set({ currentResponse: response, currentRequest: request, showHistoryPanel: false });
      },

      rerunHistoryEntry: async (entry: HistoryEntry) => {
        const { executeRequest } = get();
        const request: TauriHttpRequest = {
          method: entry.method,
          url: entry.url,
          headers: JSON.parse(entry.request_headers),
          body: entry.request_body,
        };
        set({ showHistoryPanel: false });
        await executeRequest(request);
      },
    }),
    {
      name: "kvile-storage",
      partialize: (state) => ({
        isDarkMode: state.isDarkMode,
        activeEnvironment: state.activeEnvironment,
        workspacePath: state.workspacePath,
        sidebarVisible: state.sidebarVisible,
        activeEditorView: state.activeEditorView,
      }),
    }
  )
);
