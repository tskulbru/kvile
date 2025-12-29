import { useEffect } from "react";
import { useAppStore } from "@/stores/appStore";
import { isTauriAvailable } from "@/lib/tauri";

export function useKeyboardShortcuts() {
  const {
    saveCurrentFile,
    saveAllFiles,
    openFiles,
    activeFileIndex,
    environmentConfig,
    activeEnvironment,
    setActiveEnvironment,
  } = useAppStore();
  const activeFile = activeFileIndex >= 0 ? openFiles[activeFileIndex] : null;
  const hasModifiedFiles = openFiles.some((f) => f.modified);
  const environments = environmentConfig?.environments || [];

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Ctrl+S or Cmd+S - Save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();

        if (!isTauriAvailable()) return;

        try {
          if (e.shiftKey) {
            // Ctrl+Shift+S = Save All
            if (hasModifiedFiles) {
              await saveAllFiles();
            }
          } else {
            // Ctrl+S = Save Current
            if (activeFile?.modified) {
              await saveCurrentFile();
            }
          }
        } catch (error) {
          console.error("Failed to save:", error);
        }
      }

      // Ctrl+E or Cmd+E - Cycle environments
      if ((e.ctrlKey || e.metaKey) && e.key === "e") {
        e.preventDefault();

        if (environments.length === 0) return;

        const currentIndex = environments.findIndex((env) => env.name === activeEnvironment);
        const nextIndex = (currentIndex + 1) % environments.length;
        setActiveEnvironment(environments[nextIndex].name);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    saveCurrentFile,
    saveAllFiles,
    activeFile?.modified,
    hasModifiedFiles,
    environments,
    activeEnvironment,
    setActiveEnvironment,
  ]);
}
