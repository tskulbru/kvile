import { useEffect, useRef } from "react";
import { parseHttpFile } from "@/lib/tauri";
import { useAppStore } from "@/stores/appStore";

/**
 * Hook that re-parses HTTP file content when it changes (debounced)
 */
export function useParseDebounced(
  content: string | undefined,
  fileIndex: number,
  delay: number = 500
) {
  const { updateFileParsedRequests } = useAppStore();
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (content === undefined || fileIndex < 0) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(async () => {
      try {
        const parsed = await parseHttpFile(content);
        updateFileParsedRequests(fileIndex, parsed);
      } catch (error) {
        console.warn("Failed to parse HTTP file:", error);
      }
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [content, fileIndex, delay, updateFileParsedRequests]);
}
