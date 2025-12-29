import { X } from "lucide-react";
import {
  shortcuts,
  formatShortcutDisplay,
  type ShortcutCategory,
} from "@/lib/shortcuts";
import { cn } from "@/lib/utils";

interface ShortcutsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const categoryLabels: Record<ShortcutCategory, string> = {
  file: "File",
  execution: "Execution",
  navigation: "Navigation",
  view: "View",
  editor: "Editor & Response",
};

const categoryOrder: ShortcutCategory[] = [
  "execution",
  "file",
  "navigation",
  "view",
  "editor",
];

export function ShortcutsPanel({ isOpen, onClose }: ShortcutsPanelProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative bg-card border border-border rounded-lg shadow-lg w-full max-w-2xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-accent transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-auto max-h-[calc(80vh-60px)]">
          <div className="grid grid-cols-2 gap-6">
            {categoryOrder.map((category) => {
              const categoryShortcuts = shortcuts.filter(
                (s) => s.category === category
              );
              if (categoryShortcuts.length === 0) return null;

              return (
                <div key={category}>
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                    {categoryLabels[category]}
                  </h3>
                  <div className="space-y-2">
                    {categoryShortcuts.map((shortcut) => (
                      <div
                        key={shortcut.id}
                        className="flex items-center justify-between py-1"
                      >
                        <span className="text-sm">{shortcut.name}</span>
                        <kbd
                          className={cn(
                            "px-2 py-1 text-xs font-mono rounded",
                            "bg-muted border border-border"
                          )}
                        >
                          {formatShortcutDisplay(shortcut)}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer tip */}
          <div className="mt-6 pt-4 border-t border-border text-center text-sm text-muted-foreground">
            Press <kbd className="px-1.5 py-0.5 text-xs font-mono bg-muted rounded">Escape</kbd> or click outside to close
          </div>
        </div>
      </div>
    </div>
  );
}
