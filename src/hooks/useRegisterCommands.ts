import { useEffect } from "react";
import { commandRegistry } from "@/lib/commands";
import { useAppStore } from "@/stores/appStore";
import {
  Send,
  PlayCircle,
  Save,
  FolderOpen,
  X,
  PanelLeft,
  Moon,
  Sun,
  RefreshCw,
  Keyboard,
  FileText,
  History,
  FileDown,
  ArrowLeftRight,
} from "lucide-react";

/**
 * Hook to register all application commands with the command registry
 */
export function useRegisterCommands() {
  const {
    // Actions
    saveCurrentFile,
    saveAllFiles,
    toggleSidebar,
    toggleDarkMode,
    setShowShortcutsPanel,
    setShowHistoryPanel,
    openHistoryForCompare,
    setShowCurlImport,
    setShowDiffPanel,
    refreshWorkspace,
    closeFile,
    // State for isEnabled checks
    isDarkMode,
  } = useAppStore();

  useEffect(() => {
    // Clear existing commands to avoid duplicates on hot reload
    const existingCommands = commandRegistry.getAll();
    existingCommands.forEach((cmd) => commandRegistry.unregister(cmd.id));

    // === REQUEST COMMANDS ===
    commandRegistry.register({
      id: "request.send",
      name: "Send Request",
      description: "Execute the request at cursor position",
      shortcut: "Ctrl+Enter",
      macShortcut: "Cmd+Enter",
      category: "request",
      icon: Send,
      execute: () => {
        // This is handled by existing keyboard shortcut in MainContent
        // Dispatch a keyboard event to trigger it
        const event = new KeyboardEvent("keydown", {
          key: "Enter",
          ctrlKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      },
      isEnabled: () => useAppStore.getState().activeFileIndex >= 0,
    });

    commandRegistry.register({
      id: "request.runAll",
      name: "Run All Requests",
      description: "Execute all requests in the current file",
      shortcut: "Ctrl+Shift+Enter",
      macShortcut: "Cmd+Shift+Enter",
      category: "request",
      icon: PlayCircle,
      execute: () => {
        const event = new KeyboardEvent("keydown", {
          key: "Enter",
          ctrlKey: true,
          shiftKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      },
      isEnabled: () => {
        const state = useAppStore.getState();
        const file = state.openFiles[state.activeFileIndex];
        return (file?.parsedRequests?.length ?? 0) > 0;
      },
    });

    // === FILE COMMANDS ===
    commandRegistry.register({
      id: "file.save",
      name: "Save File",
      description: "Save the current file",
      shortcut: "Ctrl+S",
      macShortcut: "Cmd+S",
      category: "file",
      icon: Save,
      execute: saveCurrentFile,
      isEnabled: () => {
        const state = useAppStore.getState();
        return state.openFiles[state.activeFileIndex]?.modified ?? false;
      },
    });

    commandRegistry.register({
      id: "file.saveAll",
      name: "Save All Files",
      description: "Save all modified files",
      category: "file",
      icon: Save,
      execute: saveAllFiles,
      isEnabled: () => {
        const state = useAppStore.getState();
        return state.openFiles.some((f) => f.modified);
      },
    });

    commandRegistry.register({
      id: "file.close",
      name: "Close File",
      description: "Close the current file tab",
      shortcut: "Ctrl+W",
      macShortcut: "Cmd+W",
      category: "file",
      icon: X,
      execute: () => {
        const index = useAppStore.getState().activeFileIndex;
        if (index >= 0) {
          closeFile(index);
        }
      },
      isEnabled: () => useAppStore.getState().activeFileIndex >= 0,
    });

    commandRegistry.register({
      id: "file.openFolder",
      name: "Open Folder",
      description: "Open a workspace folder",
      shortcut: "Ctrl+O",
      macShortcut: "Cmd+O",
      category: "file",
      icon: FolderOpen,
      execute: () => {
        // Trigger the open folder shortcut
        const event = new KeyboardEvent("keydown", {
          key: "o",
          ctrlKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      },
    });

    // === IMPORT COMMANDS ===
    commandRegistry.register({
      id: "import.curl",
      name: "Import from cURL",
      description: "Convert a cURL command to HTTP format",
      shortcut: "Ctrl+I",
      macShortcut: "Cmd+I",
      category: "import",
      icon: FileDown,
      execute: () => setShowCurlImport(true),
      isEnabled: () => useAppStore.getState().activeFileIndex >= 0,
    });

    // === VIEW COMMANDS ===
    commandRegistry.register({
      id: "view.toggleSidebar",
      name: "Toggle Sidebar",
      description: "Show or hide the sidebar panel",
      shortcut: "Ctrl+B",
      macShortcut: "Cmd+B",
      category: "view",
      icon: PanelLeft,
      execute: toggleSidebar,
    });

    commandRegistry.register({
      id: "view.toggleTheme",
      name: "Toggle Dark Mode",
      description: "Switch between light and dark theme",
      category: "view",
      icon: isDarkMode ? Sun : Moon,
      execute: toggleDarkMode,
    });

    commandRegistry.register({
      id: "view.refreshWorkspace",
      name: "Refresh Workspace",
      description: "Reload the file tree from disk",
      category: "view",
      icon: RefreshCw,
      execute: refreshWorkspace,
      isEnabled: () => useAppStore.getState().workspacePath !== null,
    });

    commandRegistry.register({
      id: "view.compareResponses",
      name: "Compare with History",
      description: "Compare current response with a previous one from history",
      category: "view",
      icon: ArrowLeftRight,
      execute: () => openHistoryForCompare(),
      isEnabled: () => {
        const state = useAppStore.getState();
        return state.currentResponse !== null && state.workspacePath !== null;
      },
    });

    commandRegistry.register({
      id: "view.closeDiff",
      name: "Close Diff View",
      description: "Close the response diff panel",
      category: "view",
      icon: X,
      execute: () => setShowDiffPanel(false),
      isEnabled: () => useAppStore.getState().showDiffPanel,
    });

    // === ENVIRONMENT COMMANDS ===
    commandRegistry.register({
      id: "environment.cycle",
      name: "Cycle Environment",
      description: "Switch to the next environment",
      shortcut: "Ctrl+E",
      macShortcut: "Cmd+E",
      category: "environment",
      execute: () => {
        const state = useAppStore.getState();
        const envs = state.environmentConfig?.environments || [];
        if (envs.length === 0) return;

        const currentIndex = envs.findIndex(
          (e) => e.name === state.activeEnvironment
        );
        const nextIndex = (currentIndex + 1) % envs.length;
        state.setActiveEnvironment(envs[nextIndex].name);
      },
      isEnabled: () => {
        const state = useAppStore.getState();
        return (state.environmentConfig?.environments?.length ?? 0) > 1;
      },
    });

    // === HELP COMMANDS ===
    commandRegistry.register({
      id: "help.shortcuts",
      name: "Keyboard Shortcuts",
      description: "View all keyboard shortcuts",
      shortcut: "Ctrl+/",
      macShortcut: "Cmd+/",
      category: "help",
      icon: Keyboard,
      execute: () => setShowShortcutsPanel(true),
    });

    commandRegistry.register({
      id: "help.history",
      name: "Request History",
      description: "View request and response history",
      shortcut: "Ctrl+H",
      macShortcut: "Cmd+H",
      category: "help",
      icon: History,
      execute: () => setShowHistoryPanel(true),
      isEnabled: () => useAppStore.getState().workspacePath !== null,
    });

    // === NAVIGATION COMMANDS ===
    commandRegistry.register({
      id: "navigation.nextTab",
      name: "Next Tab",
      description: "Switch to the next open file",
      shortcut: "Ctrl+Tab",
      category: "navigation",
      icon: FileText,
      execute: () => {
        const state = useAppStore.getState();
        if (state.openFiles.length <= 1) return;
        const nextIndex =
          (state.activeFileIndex + 1) % state.openFiles.length;
        state.setActiveFileIndex(nextIndex);
      },
      isEnabled: () => useAppStore.getState().openFiles.length > 1,
    });

    commandRegistry.register({
      id: "navigation.previousTab",
      name: "Previous Tab",
      description: "Switch to the previous open file",
      shortcut: "Ctrl+Shift+Tab",
      category: "navigation",
      icon: FileText,
      execute: () => {
        const state = useAppStore.getState();
        if (state.openFiles.length <= 1) return;
        const prevIndex =
          (state.activeFileIndex - 1 + state.openFiles.length) %
          state.openFiles.length;
        state.setActiveFileIndex(prevIndex);
      },
      isEnabled: () => useAppStore.getState().openFiles.length > 1,
    });

    // Cleanup on unmount
    return () => {
      const commands = commandRegistry.getAll();
      commands.forEach((cmd) => commandRegistry.unregister(cmd.id));
    };
  }, [
    saveCurrentFile,
    saveAllFiles,
    toggleSidebar,
    toggleDarkMode,
    setShowShortcutsPanel,
    setShowHistoryPanel,
    openHistoryForCompare,
    setShowCurlImport,
    setShowDiffPanel,
    refreshWorkspace,
    closeFile,
    isDarkMode,
  ]);
}
