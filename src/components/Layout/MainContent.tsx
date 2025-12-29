import { useState, useCallback, useEffect } from "react";
import { X, Play, Loader2, Save, AlertCircle, PlayCircle, ChevronLeft, Undo2 } from "lucide-react";
import { useAppStore } from "@/stores/appStore";
import { useScriptStore } from "@/stores/scriptStore";
import { cn } from "@/lib/utils";
import { HttpEditor } from "@/components/Editor/HttpEditor";
import { ViewToggle } from "@/components/Editor/ViewToggle";
import { RequestEditor } from "@/components/Editor/RequestEditor";
import { ResponsePanel } from "@/components/Response/ResponsePanel";
import { RunAllResults } from "@/components/Response/RunAllResults";
import { TestResultsPanel } from "@/components/Response/TestResultsPanel";
import { isTauriAvailable, type ParsedRequest } from "@/lib/tauri";
import { getRequestAtCursor } from "@/lib/http-parser";
import { substituteVariables, extractInlineVariables } from "@/lib/variables";
import { executePreRequestScript, executePostRequestScript } from "@/lib/script-runtime";
import { parseAuthFromMetadata, applyAuth, applyAuthToUrl } from "@/lib/auth-helpers";
import { updateRequestInContent } from "@/lib/http-serializer";
import { open } from "@tauri-apps/plugin-dialog";
import { useParseDebounced } from "@/hooks/useParseDebounced";

export function MainContent() {
  const {
    openFiles,
    activeFileIndex,
    setActiveFileIndex,
    closeFile,
    updateFileContent,
    updateFileParsedRequests,
    currentResponse,
    isLoading,
    executeRequest,
    saveCurrentFile,
    discardFileChanges,
    isSavingFile,
    lastError,
    clearError,
    loadWorkspace,
    cursorLine,
    getCurrentVariables,
    // Run all
    runAllResults,
    isRunningAll,
    runAllProgress,
    executeAllRequests,
    cancelRunAll,
    clearRunAllResults,
    // Editor view
    activeEditorView,
    setActiveEditorView,
    activeRequestIndex,
    setActiveRequestIndex,
  } = useAppStore();

  const [responseHeight, setResponseHeight] = useState(300);
  // Track which Run All result we're viewing (null = show list)
  const [viewingRunAllIndex, setViewingRunAllIndex] = useState<number | null>(null);

  const activeFile = activeFileIndex >= 0 ? openFiles[activeFileIndex] : null;

  // Get the active request for GUI editing
  const activeRequest = activeFile?.parsedRequests?.[activeRequestIndex ?? -1] ?? null;

  // Handle GUI request changes
  const handleRequestChange = useCallback(
    (updates: Partial<ParsedRequest>) => {
      if (!activeFile || activeRequestIndex === null) return;

      const originalRequest = activeFile.parsedRequests[activeRequestIndex];
      if (!originalRequest) return;

      // Merge updates with original request
      const updatedRequest: ParsedRequest = {
        ...originalRequest,
        ...updates,
      };

      // Update the source file content
      const result = updateRequestInContent(
        activeFile.content,
        originalRequest,
        updatedRequest,
        activeFile.parsedRequests
      );

      // Update file content (this will trigger re-parse via debounce)
      updateFileContent(activeFileIndex, result.content);

      // Also update the parsed request in-place for immediate UI feedback
      // Important: update line_number to the new position so subsequent edits work correctly
      const newParsedRequests = [...activeFile.parsedRequests];
      newParsedRequests[activeRequestIndex] = {
        ...updatedRequest,
        line_number: result.newLineNumber,
      };
      updateFileParsedRequests(activeFileIndex, newParsedRequests);
    },
    [activeFile, activeFileIndex, activeRequestIndex, updateFileContent, updateFileParsedRequests]
  );

  // Reset active request when switching files
  useEffect(() => {
    // When file changes, reset to null to avoid stale index
    setActiveRequestIndex(null);
  }, [activeFileIndex, setActiveRequestIndex]);

  // Reset viewing index when Run All starts or results are cleared
  useEffect(() => {
    if (isRunningAll || !runAllResults) {
      setViewingRunAllIndex(null);
    }
  }, [isRunningAll, runAllResults]);

  // Re-parse file content when it changes (debounced)
  useParseDebounced(activeFile?.content, activeFileIndex);

  const handleSendRequest = useCallback(async () => {
    if (!activeFile || !isTauriAvailable()) return;

    // Get script store functions
    const scriptStore = useScriptStore.getState();

    try {
      // Find the request at the current cursor position
      const parsedRequest = await getRequestAtCursor(activeFile.content, cursorLine);
      if (!parsedRequest) {
        console.warn("No request found at cursor position");
        return;
      }

      // Get all variables (environment + inline + response variables from scripts)
      const envVariables = getCurrentVariables();
      const inlineVariables = extractInlineVariables(activeFile.content);
      const responseVariables = scriptStore.getAllVariables();
      let allVariables: Record<string, unknown> = {
        ...envVariables,
        ...inlineVariables,
        ...responseVariables,
      };

      // Clear previous test results and logs
      scriptStore.clearTestResults();
      scriptStore.clearLogs();

      // Execute pre-request script if present
      if (parsedRequest.pre_script) {
        const preResult = executePreRequestScript(
          parsedRequest.pre_script,
          {
            method: parsedRequest.method,
            url: parsedRequest.url,
            headers: parsedRequest.headers,
            body: parsedRequest.body,
          },
          allVariables
        );

        // Store logs
        scriptStore.setLogs(preResult.logs);

        if (!preResult.success) {
          console.error("Pre-request script error:", preResult.error);
          useAppStore.getState().setError(`Pre-request script error: ${preResult.error}`);
          return;
        }

        // Merge in variables set by pre-request script
        allVariables = { ...allVariables, ...preResult.variables };

        // Also update the script store with any new variables
        for (const [name, value] of Object.entries(preResult.variables)) {
          if (!(name in responseVariables)) {
            scriptStore.setVariable(name, value, parsedRequest.name || `request_${parsedRequest.line_number}`);
          }
        }
      }

      // Convert all variables to strings for substitution
      const stringVariables: Record<string, string> = {};
      for (const [key, value] of Object.entries(allVariables)) {
        stringVariables[key] = typeof value === 'string' ? value : JSON.stringify(value);
      }

      // Substitute variables in URL, headers, and body
      const substitutedUrl = substituteVariables(parsedRequest.url, stringVariables);
      const substitutedBody = parsedRequest.body
        ? substituteVariables(parsedRequest.body, stringVariables)
        : undefined;
      const substitutedHeaders = Object.fromEntries(
        Object.entries(parsedRequest.headers).map(([k, v]) => [
          k,
          substituteVariables(v, stringVariables).result,
        ])
      );

      // Log warnings for missing variables
      const allMissing = [
        ...substitutedUrl.missingVariables,
        ...(substitutedBody?.missingVariables || []),
      ];
      if (allMissing.length > 0) {
        console.warn("Missing variables:", [...new Set(allMissing)]);
      }

      // Check for auth directives and apply authentication
      // First substitute variables in metadata values
      const substitutedMetadata: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsedRequest.metadata || {})) {
        substitutedMetadata[key] = substituteVariables(value, stringVariables).result;
      }

      const authConfig = parseAuthFromMetadata(substitutedMetadata);
      let finalHeaders = substitutedHeaders;
      let finalUrl = substitutedUrl.result;

      if (authConfig) {
        try {
          finalHeaders = await applyAuth(substitutedHeaders, authConfig);
          finalUrl = applyAuthToUrl(substitutedUrl.result, authConfig);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Authentication failed";
          useAppStore.getState().setError(`Auth error: ${message}`);
          return;
        }
      }

      // Build and execute the request with substituted values
      const httpRequest = {
        method: parsedRequest.method,
        url: finalUrl,
        headers: finalHeaders,
        body: substitutedBody?.result,
      };

      await executeRequest(httpRequest);

      // Execute post-request script if present
      if (parsedRequest.post_script) {
        // Get the response that was just set
        const currentResponse = useAppStore.getState().currentResponse;
        if (currentResponse) {
          const postResult = executePostRequestScript(
            parsedRequest.post_script,
            {
              body: currentResponse.body,
              headers: currentResponse.headers,
              status: currentResponse.status,
              time: currentResponse.time,
            },
            allVariables
          );

          // Store test results and logs
          scriptStore.setTestResults(postResult.tests);
          scriptStore.setLogs([...scriptStore.lastScriptLogs, ...postResult.logs]);

          if (!postResult.success) {
            console.error("Post-request script error:", postResult.error);
            // Don't fail the request, just log the error
          }

          // Store variables set by post-request script
          const requestSource = parsedRequest.name || `request_${parsedRequest.line_number}`;
          for (const [name, value] of Object.entries(postResult.variables)) {
            scriptStore.setVariable(name, value, requestSource);
          }

          // Show script console if there are test results, logs, or errors
          if (postResult.tests.length > 0 || postResult.logs.length > 0 || !postResult.success) {
            scriptStore.setShowScriptConsole(true);
          }
        }
      }
    } catch (error) {
      console.error("Failed to send request:", error);
    }
  }, [activeFile, executeRequest, cursorLine, getCurrentVariables]);

  // Ctrl+Enter to send request, Ctrl+Shift+Enter to run all
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) {
          // Ctrl+Shift+Enter = Run All
          if (!isRunningAll && activeFile?.parsedRequests?.length) {
            executeAllRequests();
          }
        } else {
          // Ctrl+Enter = Send single request
          handleSendRequest();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSendRequest, executeAllRequests, isRunningAll, activeFile]);

  const handleSave = useCallback(async () => {
    if (!activeFile?.modified || !isTauriAvailable()) return;
    await saveCurrentFile();
  }, [activeFile?.modified, saveCurrentFile]);

  const handleOpenFolder = useCallback(async () => {
    if (!isTauriAvailable()) return;
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
  }, [loadWorkspace]);

  if (openFiles.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Welcome to Kvile</h2>
          <p className="text-sm mb-4">
            Open a folder or create a new .http file to get started
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={handleOpenFolder}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Open Folder
            </button>
            <button className="px-4 py-2 border border-input rounded-md hover:bg-accent transition-colors">
              New File
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Tab Bar */}
      <div className="flex items-center border-b border-border bg-card overflow-x-auto">
        {openFiles.map((file, index) => (
          <div
            key={file.path}
            className={cn(
              "flex items-center gap-2 px-3 py-2 border-r border-border cursor-pointer",
              "hover:bg-accent transition-colors min-w-0 relative",
              index === activeFileIndex && "bg-background",
              // Visual draft indicator - left border accent for modified files
              file.modified && "border-l-2 border-l-yellow-500"
            )}
            onClick={() => setActiveFileIndex(index)}
          >
            <span className="truncate text-sm max-w-[150px]">
              {file.name}
              {file.modified && (
                <span className="text-yellow-500 ml-1 font-bold" title="Unsaved changes">
                  *
                </span>
              )}
            </span>
            <button
              className="p-0.5 rounded hover:bg-muted transition-colors flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                closeFile(index);
              }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Error Banner */}
      {lastError && (
        <div className="flex items-center gap-2 p-2 bg-destructive/10 border-b border-destructive/20 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1">{lastError}</span>
          <button
            onClick={clearError}
            className="text-xs underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Request Bar */}
      <div className="flex items-center gap-2 p-2 border-b border-border bg-card">
        {/* View Toggle */}
        {activeFile && (
          <ViewToggle
            activeView={activeEditorView}
            onViewChange={setActiveEditorView}
          />
        )}
        <div className="flex-1 text-sm text-muted-foreground font-mono truncate">
          {activeFile ? (
            activeEditorView === 'gui' && activeRequest ? (
              <span>{activeRequest.method} {activeRequest.name || activeRequest.url}</span>
            ) : (
              <span>Request from {activeFile.name}</span>
            )
          ) : (
            <span>Open a .http file to send requests</span>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={isSavingFile || !activeFile?.modified}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 border border-input rounded-md",
            "hover:bg-accent transition-colors disabled:opacity-50"
          )}
          title="Save file (Ctrl+S)"
        >
          {isSavingFile ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save
        </button>
        <button
          onClick={() => discardFileChanges()}
          disabled={!activeFile?.modified}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 border border-input rounded-md",
            "hover:bg-destructive/10 hover:border-destructive/50 hover:text-destructive",
            "transition-colors disabled:opacity-50"
          )}
          title="Discard changes and reload from disk"
        >
          <Undo2 className="h-4 w-4" />
          Discard
        </button>
        <button
          onClick={handleSendRequest}
          disabled={isLoading || isRunningAll || !activeFile}
          className={cn(
            "flex items-center gap-2 px-4 py-1.5 bg-primary text-primary-foreground rounded-md",
            "hover:bg-primary/90 transition-colors disabled:opacity-50"
          )}
          title="Send request (Ctrl+Enter)"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          Send
        </button>
        <button
          onClick={() => isRunningAll ? cancelRunAll() : executeAllRequests()}
          disabled={isLoading || !activeFile?.parsedRequests?.length}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 border border-input rounded-md",
            "hover:bg-accent transition-colors disabled:opacity-50",
            isRunningAll && "bg-destructive/10 border-destructive/50"
          )}
          title="Run all requests (Ctrl+Shift+Enter)"
        >
          {isRunningAll ? (
            <>
              <X className="h-4 w-4" />
              <span>{Math.round(runAllProgress)}%</span>
            </>
          ) : (
            <>
              <PlayCircle className="h-4 w-4" />
              <span>Run All</span>
            </>
          )}
        </button>
      </div>

      {/* Run All Progress Bar */}
      {isRunningAll && (
        <div className="h-1 bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-200"
            style={{ width: `${runAllProgress}%` }}
          />
        </div>
      )}

      {/* Editor and Response Split */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Editor */}
        <div
          className="flex-1 overflow-hidden"
          style={{
            minHeight: (currentResponse || runAllResults || isRunningAll) ? `calc(100% - ${responseHeight}px - 4px)` : "100%",
          }}
        >
          {activeFile && (
            activeEditorView === 'gui' ? (
              activeRequest ? (
                <RequestEditor
                  request={activeRequest}
                  onRequestChange={handleRequestChange}
                  variables={getCurrentVariables()}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <p className="text-sm mb-2">No request selected</p>
                    <p className="text-xs">
                      Expand a .http file in the sidebar and click a request,<br />
                      or switch to Source view to edit the raw file.
                    </p>
                  </div>
                </div>
              )
            ) : (
              <HttpEditor
                value={activeFile.content}
                onChange={(value) =>
                  updateFileContent(activeFileIndex, value || "")
                }
              />
            )
          )}
        </div>

        {/* Response Panel */}
        {(currentResponse || runAllResults || isRunningAll) && (
          <>
            {/* Resize Handle */}
            <div
              className="h-1 cursor-row-resize hover:bg-primary/20 active:bg-primary/30 transition-colors bg-border"
              onMouseDown={(e) => {
                e.preventDefault();
                const startY = e.clientY;
                const startHeight = responseHeight;

                const onMouseMove = (e: MouseEvent) => {
                  const newHeight = startHeight - (e.clientY - startY);
                  setResponseHeight(Math.max(100, Math.min(600, newHeight)));
                };

                const onMouseUp = () => {
                  document.removeEventListener("mousemove", onMouseMove);
                  document.removeEventListener("mouseup", onMouseUp);
                };

                document.addEventListener("mousemove", onMouseMove);
                document.addEventListener("mouseup", onMouseUp);
              }}
            />
            <div style={{ height: responseHeight }}>
              {runAllResults && viewingRunAllIndex !== null ? (
                // Viewing a single response from Run All results
                <div className="h-full flex flex-col">
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
                    <button
                      onClick={() => setViewingRunAllIndex(null)}
                      className="flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Back to Results
                    </button>
                    <span className="text-sm text-muted-foreground">
                      ({viewingRunAllIndex + 1} of {runAllResults.results.length})
                    </span>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    {runAllResults.results[viewingRunAllIndex]?.response && (
                      <ResponsePanel response={runAllResults.results[viewingRunAllIndex].response!} />
                    )}
                  </div>
                </div>
              ) : runAllResults ? (
                <RunAllResults
                  results={runAllResults}
                  onClose={() => {
                    clearRunAllResults();
                    setViewingRunAllIndex(null);
                  }}
                  onViewResponse={(index) => {
                    const result = runAllResults.results[index];
                    if (result?.response) {
                      setViewingRunAllIndex(index);
                    }
                  }}
                />
              ) : isRunningAll ? (
                <div className="h-full flex flex-col items-center justify-center bg-card text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin mb-3" />
                  <p className="text-sm font-medium">Running all requests...</p>
                  <p className="text-xs mt-1">{Math.round(runAllProgress)}% complete</p>
                </div>
              ) : currentResponse ? (
                <div className="h-full flex flex-col">
                  <div className="flex-1 overflow-hidden">
                    <ResponsePanel response={currentResponse} />
                  </div>
                  <TestResultsPanel />
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
