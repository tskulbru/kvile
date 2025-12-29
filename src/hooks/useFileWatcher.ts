import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useAppStore } from "@/stores/appStore";
import { isTauriAvailable } from "@/lib/tauri";

/**
 * Hook that listens for file change events from the backend
 * and automatically refreshes the file tree when changes are detected
 */
export function useFileWatcher() {
  const refreshWorkspace = useAppStore((state) => state.refreshWorkspace);
  const workspacePath = useAppStore((state) => state.workspacePath);

  useEffect(() => {
    if (!isTauriAvailable() || !workspacePath) return;

    const unlisten = listen<string>("file-changed", (event) => {
      console.log("File change detected:", event.payload);
      refreshWorkspace();
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [workspacePath, refreshWorkspace]);
}
