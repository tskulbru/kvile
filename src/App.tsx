import { useEffect, useState, useCallback } from "react";
import { Sidebar } from "./components/Layout/Sidebar";
import { MainContent } from "./components/Layout/MainContent";
import { StatusBar } from "./components/Layout/StatusBar";
import { UnsavedChangesDialog } from "./components/Dialog/UnsavedChangesDialog";
import { ShortcutsPanel } from "./components/Help/ShortcutsPanel";
import { CommandPalette } from "./components/CommandPalette/CommandPalette";
import { HistoryPanel } from "./components/History/HistoryPanel";
import { CurlImportDialog } from "./components/Import/CurlImportDialog";
import { DiffPanel } from "./components/Response/DiffPanel";
import { SettingsPanel } from "./components/Settings/SettingsPanel";
import { useAppStore } from "./stores/appStore";
import { useSettingsStore } from "./stores/settingsStore";
import { useFileWatcher } from "./hooks/useFileWatcher";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useGlobalShortcuts } from "./hooks/useGlobalShortcuts";
import { useRegisterCommands } from "./hooks/useRegisterCommands";

function App() {
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const {
    sidebarVisible,
    showShortcutsPanel,
    setShowShortcutsPanel,
    showCommandPalette,
    setShowCommandPalette,
    showHistoryPanel,
    setShowHistoryPanel,
    historyCompareMode,
    showCurlImport,
    setShowCurlImport,
    showSettingsPanel,
    setShowSettingsPanel,
    historyEntries,
    isLoadingHistory,
    viewHistoryEntry,
    rerunHistoryEntry,
    deleteHistoryEntry,
    clearHistory,
    openFiles,
    activeFileIndex,
    updateFileContent,
    // Diff
    showDiffPanel,
    setShowDiffPanel,
    diffLeftResponse,
    diffRightResponse,
    compareWithCurrent,
    currentResponse,
    currentRequest,
  } = useAppStore();

  // Get theme from settings store
  const { theme, getResolvedTheme } = useSettingsStore();
  const isDarkMode = getResolvedTheme() === 'dark';

  // Listen for file changes and auto-refresh
  useFileWatcher();

  // Enable keyboard shortcuts
  useKeyboardShortcuts();

  // Enable global shortcuts (sidebar toggle, tab navigation, etc.)
  useGlobalShortcuts();

  // Register all commands for the command palette
  useRegisterCommands();

  // Handle inserting cURL import into current file
  const handleCurlImportInsert = useCallback(
    (httpContent: string) => {
      const activeFile = activeFileIndex >= 0 ? openFiles[activeFileIndex] : null;
      if (activeFile) {
        // Append to current file with separator
        const separator = activeFile.content.trim() ? "\n\n###\n\n" : "";
        updateFileContent(activeFileIndex, activeFile.content + separator + httpContent);
      }
    },
    [activeFileIndex, openFiles, updateFileContent]
  );

  // Apply theme to document
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  // Listen for system theme changes when using 'system' theme
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      // Force re-render to update resolved theme
      useSettingsStore.getState();
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        {sidebarVisible && (
          <>
            <div
              className="flex-shrink-0 border-r border-border"
              style={{ width: sidebarWidth }}
            >
              <Sidebar />
            </div>

            {/* Resize Handle */}
            <div
              className="w-1 cursor-col-resize hover:bg-primary/20 active:bg-primary/30 transition-colors"
              onMouseDown={(e) => {
                e.preventDefault();
                const startX = e.clientX;
                const startWidth = sidebarWidth;

                const onMouseMove = (e: MouseEvent) => {
                  const newWidth = startWidth + (e.clientX - startX);
                  setSidebarWidth(Math.max(200, Math.min(500, newWidth)));
                };

                const onMouseUp = () => {
                  document.removeEventListener("mousemove", onMouseMove);
                  document.removeEventListener("mouseup", onMouseUp);
                };

                document.addEventListener("mousemove", onMouseMove);
                document.addEventListener("mouseup", onMouseUp);
              }}
            />
          </>
        )}

        {/* Main Content */}
        <div className="flex-1 overflow-hidden">
          <MainContent />
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar />

      {/* Dialogs */}
      <UnsavedChangesDialog />

      {/* Keyboard Shortcuts Help Panel */}
      <ShortcutsPanel
        isOpen={showShortcutsPanel}
        onClose={() => setShowShortcutsPanel(false)}
      />

      {/* Command Palette */}
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
      />

      {/* History Panel */}
      <HistoryPanel
        isOpen={showHistoryPanel}
        onClose={() => setShowHistoryPanel(false)}
        entries={historyEntries}
        isLoading={isLoadingHistory}
        onViewEntry={viewHistoryEntry}
        onRerunEntry={rerunHistoryEntry}
        onDeleteEntry={deleteHistoryEntry}
        onClearHistory={clearHistory}
        onCompareEntry={compareWithCurrent}
        canCompare={currentResponse !== null}
        compareMode={historyCompareMode}
        currentUrl={currentRequest?.url}
        currentMethod={currentRequest?.method}
      />

      {/* cURL Import Dialog */}
      {showCurlImport && (
        <CurlImportDialog
          onClose={() => setShowCurlImport(false)}
          onInsert={handleCurlImportInsert}
        />
      )}

      {/* Response Diff Panel */}
      {showDiffPanel && diffLeftResponse && diffRightResponse && (
        <DiffPanel
          leftResponse={diffLeftResponse}
          rightResponse={diffRightResponse}
          onClose={() => setShowDiffPanel(false)}
        />
      )}

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={showSettingsPanel}
        onClose={() => setShowSettingsPanel(false)}
      />
    </div>
  );
}

export default App;
