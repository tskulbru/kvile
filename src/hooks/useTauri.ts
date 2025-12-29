import { useState, useEffect } from "react";
import * as tauri from "@/lib/tauri";

export function useTauri() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsReady(tauri.isTauriAvailable());
  }, []);

  return {
    isReady,
    ...tauri,
  };
}
