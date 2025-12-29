/**
 * Keyboard shortcuts registry and handler
 */

export type ShortcutCategory = "file" | "execution" | "navigation" | "view" | "editor";

export interface Shortcut {
  id: string;
  name: string;
  description: string;
  keys: string; // e.g., "Ctrl+S" or "Cmd+S"
  macKeys?: string; // macOS specific keys
  category: ShortcutCategory;
}

// Check if running on macOS
export function isMac(): boolean {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

/**
 * Format shortcut keys for display
 */
export function formatShortcutDisplay(shortcut: Shortcut): string {
  const keys = isMac() ? (shortcut.macKeys || shortcut.keys) : shortcut.keys;

  if (isMac()) {
    return keys
      .replace(/Ctrl\+/g, "⌃")
      .replace(/Cmd\+/g, "⌘")
      .replace(/Alt\+/g, "⌥")
      .replace(/Shift\+/g, "⇧")
      .replace(/Enter/g, "↵")
      .replace(/Escape/g, "⎋");
  }

  return keys;
}

/**
 * Get the key combination string for tooltip display
 */
export function getShortcutHint(shortcut: Shortcut): string {
  const keys = isMac() ? (shortcut.macKeys || shortcut.keys) : shortcut.keys;
  return keys;
}

// Default shortcuts registry
export const shortcuts: Shortcut[] = [
  // File operations
  {
    id: "save-file",
    name: "Save File",
    description: "Save the current file",
    keys: "Ctrl+S",
    macKeys: "Cmd+S",
    category: "file",
  },
  {
    id: "open-folder",
    name: "Open Folder",
    description: "Open a workspace folder",
    keys: "Ctrl+O",
    macKeys: "Cmd+O",
    category: "file",
  },
  {
    id: "close-tab",
    name: "Close Tab",
    description: "Close the current tab",
    keys: "Ctrl+W",
    macKeys: "Cmd+W",
    category: "file",
  },

  // Execution
  {
    id: "send-request",
    name: "Send Request",
    description: "Execute the request at cursor position",
    keys: "Ctrl+Enter",
    macKeys: "Cmd+Enter",
    category: "execution",
  },
  {
    id: "run-all",
    name: "Run All Requests",
    description: "Execute all requests in the file",
    keys: "Ctrl+Shift+Enter",
    macKeys: "Cmd+Shift+Enter",
    category: "execution",
  },

  // Navigation
  {
    id: "cycle-environment",
    name: "Cycle Environment",
    description: "Switch to the next environment",
    keys: "Ctrl+E",
    macKeys: "Cmd+E",
    category: "navigation",
  },
  {
    id: "next-tab",
    name: "Next Tab",
    description: "Switch to the next tab",
    keys: "Ctrl+Tab",
    macKeys: "Ctrl+Tab",
    category: "navigation",
  },
  {
    id: "previous-tab",
    name: "Previous Tab",
    description: "Switch to the previous tab",
    keys: "Ctrl+Shift+Tab",
    macKeys: "Ctrl+Shift+Tab",
    category: "navigation",
  },

  // View
  {
    id: "toggle-sidebar",
    name: "Toggle Sidebar",
    description: "Show or hide the sidebar",
    keys: "Ctrl+B",
    macKeys: "Cmd+B",
    category: "view",
  },
  {
    id: "command-palette",
    name: "Command Palette",
    description: "Open the command palette",
    keys: "Ctrl+Shift+P",
    macKeys: "Cmd+Shift+P",
    category: "view",
  },
  {
    id: "show-shortcuts",
    name: "Keyboard Shortcuts",
    description: "Show keyboard shortcuts help",
    keys: "Ctrl+/",
    macKeys: "Cmd+/",
    category: "view",
  },
  {
    id: "show-history",
    name: "Request History",
    description: "View request and response history",
    keys: "Ctrl+H",
    macKeys: "Cmd+H",
    category: "view",
  },

  // Editor/Response
  {
    id: "search-response",
    name: "Search in Response",
    description: "Search within the response body",
    keys: "Ctrl+F",
    macKeys: "Cmd+F",
    category: "editor",
  },
  {
    id: "save-response",
    name: "Save Response",
    description: "Save response to a file",
    keys: "Ctrl+Shift+S",
    macKeys: "Cmd+Shift+S",
    category: "editor",
  },
];

/**
 * Get shortcuts by category
 */
export function getShortcutsByCategory(category: ShortcutCategory): Shortcut[] {
  return shortcuts.filter((s) => s.category === category);
}

/**
 * Get a shortcut by ID
 */
export function getShortcut(id: string): Shortcut | undefined {
  return shortcuts.find((s) => s.id === id);
}

/**
 * Check if a keyboard event matches a shortcut
 */
export function matchesShortcut(event: KeyboardEvent, shortcut: Shortcut): boolean {
  const keys = isMac() ? (shortcut.macKeys || shortcut.keys) : shortcut.keys;
  const parts = keys.toLowerCase().split("+");

  const needsCtrl = parts.includes("ctrl");
  const needsCmd = parts.includes("cmd");
  const needsAlt = parts.includes("alt");
  const needsShift = parts.includes("shift");
  const keyPart = parts.find((p) => !["ctrl", "cmd", "alt", "shift"].includes(p));

  // On Mac, Cmd is metaKey; on Windows/Linux, Ctrl is ctrlKey
  const modKey = isMac() ? event.metaKey : event.ctrlKey;
  const needsMod = needsCtrl || needsCmd;

  if (needsMod && !modKey) return false;
  if (!needsMod && modKey) return false;
  if (needsAlt !== event.altKey) return false;
  if (needsShift !== event.shiftKey) return false;

  // Handle special keys
  const eventKey = event.key.toLowerCase();
  if (keyPart === "enter" && eventKey !== "enter") return false;
  if (keyPart === "escape" && eventKey !== "escape") return false;
  if (keyPart === "tab" && eventKey !== "tab") return false;
  if (keyPart === "/" && eventKey !== "/") return false;

  // Handle letter/number keys
  if (keyPart && !["enter", "escape", "tab", "/"].includes(keyPart)) {
    if (eventKey !== keyPart) return false;
  }

  return true;
}
