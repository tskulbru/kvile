import { useState, useCallback } from "react";
import { X, FileDown, Copy, AlertCircle, Loader2 } from "lucide-react";
import { convertCurlToHttp, isTauriAvailable } from "@/lib/tauri";

interface CurlImportDialogProps {
  onClose: () => void;
  onInsert: (httpContent: string) => void;
}

export function CurlImportDialog({ onClose, onInsert }: CurlImportDialogProps) {
  const [curlCommand, setCurlCommand] = useState("");
  const [httpOutput, setHttpOutput] = useState("");
  const [error, setError] = useState("");
  const [isConverting, setIsConverting] = useState(false);

  const handleConvert = useCallback(async () => {
    if (!curlCommand.trim()) {
      setError("Please enter a cURL command");
      return;
    }

    if (!isTauriAvailable()) {
      setError("Not running in Tauri context");
      return;
    }

    setIsConverting(true);
    setError("");

    try {
      const result = await convertCurlToHttp(curlCommand);
      setHttpOutput(result);
    } catch (e) {
      setError(String(e));
      setHttpOutput("");
    } finally {
      setIsConverting(false);
    }
  }, [curlCommand]);

  const handleInsert = useCallback(() => {
    if (httpOutput) {
      onInsert(httpOutput);
      onClose();
    }
  }, [httpOutput, onInsert, onClose]);

  const handleCopyOutput = useCallback(() => {
    if (httpOutput) {
      navigator.clipboard.writeText(httpOutput);
    }
  }, [httpOutput]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-card p-6 rounded-lg shadow-xl w-[900px] max-w-[90vw] max-h-[90vh] flex flex-col border border-border">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileDown className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Import from cURL</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-accent transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 grid grid-cols-2 gap-4 min-h-0 overflow-hidden">
          {/* Input */}
          <div className="flex flex-col">
            <label className="text-sm font-medium mb-2 flex items-center justify-between">
              <span>cURL Command</span>
              <span className="text-xs text-muted-foreground font-normal">
                Paste from browser DevTools
              </span>
            </label>
            <textarea
              value={curlCommand}
              onChange={(e) => setCurlCommand(e.target.value)}
              className="flex-1 p-3 border border-input rounded-md font-mono text-sm bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder={`curl 'https://api.example.com/users' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer token' \\
  --data-raw '{"name": "John"}'`}
              autoFocus
            />
          </div>

          {/* Output */}
          <div className="flex flex-col">
            <label className="text-sm font-medium mb-2 flex items-center justify-between">
              <span>HTTP Format</span>
              {httpOutput && (
                <button
                  onClick={handleCopyOutput}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Copy className="h-3 w-3" />
                  Copy
                </button>
              )}
            </label>
            <textarea
              value={httpOutput}
              readOnly
              className="flex-1 p-3 border border-input rounded-md font-mono text-sm bg-muted resize-none"
              placeholder="Converted HTTP format will appear here..."
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Help text */}
        <div className="mt-4 text-xs text-muted-foreground">
          <p>
            <strong>Tip:</strong> To copy a request as cURL from your browser:
            Open DevTools (F12) → Network tab → Right-click request → Copy →
            Copy as cURL
          </p>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 hover:bg-accent rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConvert}
            disabled={isConverting || !curlCommand.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/80 rounded-md transition-colors disabled:opacity-50"
          >
            {isConverting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Converting...
              </>
            ) : (
              "Convert"
            )}
          </button>
          <button
            onClick={handleInsert}
            disabled={!httpOutput}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            Insert
          </button>
        </div>
      </div>
    </div>
  );
}
