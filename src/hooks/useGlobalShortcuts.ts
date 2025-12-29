import { useEffect, useCallback } from "react";
import { useAppStore } from "@/stores/appStore";
import { isMac } from "@/lib/shortcuts";
import { open } from "@tauri-apps/plugin-dialog";
import { isTauriAvailable } from "@/lib/tauri";

/**
 * Hook to handle global keyboard shortcuts
 * This centralizes keyboard shortcut handling for the app
 */
export function useGlobalShortcuts() {
  const {
    // Actions
    toggleSidebar,
    setShowShortcutsPanel,
    setShowCommandPalette,
    setShowHistoryPanel,
    setShowCurlImport,
    setShowDiffPanel,
    closeFile,
    activeFileIndex,
    openFiles,
    setActiveFileIndex,
    loadWorkspace,
    workspacePath,
    // State
    showShortcutsPanel,
    showCommandPalette,
    showHistoryPanel,
    showCurlImport,
    showDiffPanel,
  } = useAppStore();

  // Handle opening a folder
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

  // Handle tab navigation
  const goToNextTab = useCallback(() => {
    if (openFiles.length <= 1) return;
    const nextIndex = (activeFileIndex + 1) % openFiles.length;
    setActiveFileIndex(nextIndex);
  }, [openFiles.length, activeFileIndex, setActiveFileIndex]);

  const goToPreviousTab = useCallback(() => {
    if (openFiles.length <= 1) return;
    const prevIndex = (activeFileIndex - 1 + openFiles.length) % openFiles.length;
    setActiveFileIndex(prevIndex);
  }, [openFiles.length, activeFileIndex, setActiveFileIndex]);

  // Handle closing current tab
  const handleCloseTab = useCallback(() => {
    if (activeFileIndex >= 0) {
      closeFile(activeFileIndex);
    }
  }, [closeFile, activeFileIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const modKey = isMac() ? e.metaKey : e.ctrlKey;

      // Escape to close panels
      if (e.key === "Escape") {
        if (showCommandPalette) {
          e.preventDefault();
          setShowCommandPalette(false);
          return;
        }
        if (showShortcutsPanel) {
          e.preventDefault();
          setShowShortcutsPanel(false);
          return;
        }
        if (showHistoryPanel) {
          e.preventDefault();
          setShowHistoryPanel(false);
          return;
        }
        if (showCurlImport) {
          e.preventDefault();
          setShowCurlImport(false);
          return;
        }
        if (showDiffPanel) {
          e.preventDefault();
          setShowDiffPanel(false);
          return;
        }
      }

      // Ctrl+Shift+P or Cmd+Shift+P - Command Palette
      if (modKey && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setShowCommandPalette(!showCommandPalette);
        return;
      }

      // Ctrl+/ or Cmd+/ - Show shortcuts
      if (modKey && e.key === "/") {
        e.preventDefault();
        setShowShortcutsPanel(!showShortcutsPanel);
        return;
      }

      // Ctrl+H or Cmd+H - Show history (only if workspace is open)
      if (modKey && !e.shiftKey && e.key.toLowerCase() === "h" && workspacePath) {
        e.preventDefault();
        setShowHistoryPanel(!showHistoryPanel);
        return;
      }

      // Ctrl+B or Cmd+B - Toggle sidebar
      if (modKey && !e.shiftKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      // Ctrl+O or Cmd+O - Open folder
      if (modKey && !e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        handleOpenFolder();
        return;
      }

      // Ctrl+I or Cmd+I - Import from cURL (only if a file is open)
      if (modKey && !e.shiftKey && e.key.toLowerCase() === "i" && activeFileIndex >= 0) {
        e.preventDefault();
        setShowCurlImport(!showCurlImport);
        return;
      }

      // Ctrl+W or Cmd+W - Close tab
      if (modKey && !e.shiftKey && e.key.toLowerCase() === "w") {
        e.preventDefault();
        handleCloseTab();
        return;
      }

      // Ctrl+Tab - Next tab
      if (e.ctrlKey && !e.shiftKey && e.key === "Tab") {
        e.preventDefault();
        goToNextTab();
        return;
      }

      // Ctrl+Shift+Tab - Previous tab
      if (e.ctrlKey && e.shiftKey && e.key === "Tab") {
        e.preventDefault();
        goToPreviousTab();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    toggleSidebar,
    setShowShortcutsPanel,
    setShowCommandPalette,
    setShowHistoryPanel,
    setShowCurlImport,
    setShowDiffPanel,
    showShortcutsPanel,
    showCommandPalette,
    showHistoryPanel,
    showCurlImport,
    showDiffPanel,
    activeFileIndex,
    workspacePath,
    handleOpenFolder,
    handleCloseTab,
    goToNextTab,
    goToPreviousTab,
  ]);
}
