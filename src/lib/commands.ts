/**
 * Command registry for the command palette
 */

import type { LucideIcon } from "lucide-react";
import { isMac } from "./shortcuts";

export type CommandCategory =
  | "file"
  | "request"
  | "view"
  | "environment"
  | "navigation"
  | "import"
  | "help";

export interface Command {
  id: string;
  name: string;
  description?: string;
  shortcut?: string;
  macShortcut?: string;
  category: CommandCategory;
  icon?: LucideIcon;
  execute: () => void | Promise<void>;
  isEnabled?: () => boolean;
}

class CommandRegistry {
  private commands: Map<string, Command> = new Map();

  register(command: Command): void {
    this.commands.set(command.id, command);
  }

  unregister(id: string): void {
    this.commands.delete(id);
  }

  get(id: string): Command | undefined {
    return this.commands.get(id);
  }

  getAll(): Command[] {
    return Array.from(this.commands.values());
  }

  getByCategory(category: CommandCategory): Command[] {
    return this.getAll().filter((c) => c.category === category);
  }

  execute(id: string): void {
    const command = this.commands.get(id);
    if (command && (command.isEnabled?.() ?? true)) {
      command.execute();
    }
  }

  search(query: string): Command[] {
    const all = this.getAll().filter((cmd) => cmd.isEnabled?.() ?? true);

    if (!query.trim()) {
      return all.sort((a, b) => a.name.localeCompare(b.name));
    }

    const lowerQuery = query.toLowerCase();
    return all
      .filter(
        (cmd) =>
          cmd.name.toLowerCase().includes(lowerQuery) ||
          cmd.id.toLowerCase().includes(lowerQuery) ||
          cmd.description?.toLowerCase().includes(lowerQuery) ||
          cmd.category.toLowerCase().includes(lowerQuery)
      )
      .sort((a, b) => {
        // Prioritize exact matches at start of name
        const aStarts = a.name.toLowerCase().startsWith(lowerQuery);
        const bStarts = b.name.toLowerCase().startsWith(lowerQuery);
        if (aStarts && !bStarts) return -1;
        if (bStarts && !aStarts) return 1;

        // Then prioritize name matches over description matches
        const aNameMatch = a.name.toLowerCase().includes(lowerQuery);
        const bNameMatch = b.name.toLowerCase().includes(lowerQuery);
        if (aNameMatch && !bNameMatch) return -1;
        if (bNameMatch && !aNameMatch) return 1;

        return a.name.localeCompare(b.name);
      });
  }

  /**
   * Get the display shortcut for a command
   */
  getShortcutDisplay(command: Command): string | undefined {
    if (!command.shortcut) return undefined;

    const shortcut = isMac()
      ? command.macShortcut || command.shortcut
      : command.shortcut;

    if (isMac()) {
      return shortcut
        .replace(/Ctrl\+/g, "⌃")
        .replace(/Cmd\+/g, "⌘")
        .replace(/Alt\+/g, "⌥")
        .replace(/Shift\+/g, "⇧")
        .replace(/Enter/g, "↵");
    }

    return shortcut;
  }
}

// Export singleton instance
export const commandRegistry = new CommandRegistry();

// Category display names
export const categoryLabels: Record<CommandCategory, string> = {
  file: "File",
  request: "Request",
  view: "View",
  environment: "Environment",
  navigation: "Navigation",
  import: "Import",
  help: "Help",
};
