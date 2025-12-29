import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Settings {
  // General
  theme: 'light' | 'dark' | 'system';
  autoSave: boolean;
  showWelcome: boolean;

  // Editor
  fontSize: number;
  fontFamily: string;
  tabSize: number;
  wordWrap: 'on' | 'off';
  lineNumbers: 'on' | 'off' | 'relative';
  minimap: boolean;

  // Request
  defaultTimeout: number;
  followRedirects: boolean;
  verifySsl: boolean;
  maxResponseSize: number;

  // Environment
  autoLoadEnv: boolean;
  showVariableHints: boolean;
  maskSensitiveValues: boolean;

  // Editor View
  defaultEditorView: 'gui' | 'source';
}

export const defaultSettings: Settings = {
  // General
  theme: 'system',
  autoSave: false,
  showWelcome: true,

  // Editor
  fontSize: 14,
  fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
  tabSize: 2,
  wordWrap: 'on',
  lineNumbers: 'on',
  minimap: false,

  // Request
  defaultTimeout: 30000,
  followRedirects: true,
  verifySsl: true,
  maxResponseSize: 10 * 1024 * 1024, // 10MB

  // Environment
  autoLoadEnv: true,
  showVariableHints: true,
  maskSensitiveValues: true,

  // Editor View
  defaultEditorView: 'gui',
};

interface SettingsStore extends Settings {
  // Actions
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  setSettings: (settings: Partial<Settings>) => void;
  resetToDefaults: () => void;

  // Computed values
  getResolvedTheme: () => 'light' | 'dark';
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      ...defaultSettings,

      setSetting: (key, value) => set({ [key]: value }),

      setSettings: (settings) => set(settings),

      resetToDefaults: () => set(defaultSettings),

      getResolvedTheme: () => {
        const { theme } = get();
        if (theme === 'system') {
          return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return theme;
      },
    }),
    {
      name: 'kvile-settings',
    }
  )
);
