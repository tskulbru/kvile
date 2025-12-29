/**
 * Store for script-related state: response variables, test results, and logs
 */
import { create } from 'zustand';
import type { TestResult, ScriptLog } from '@/lib/script-runtime';

// Limits to prevent unbounded memory growth
const MAX_VARIABLES = 100;
const MAX_LOGS = 500;

export interface ResponseVariable {
  name: string;
  value: unknown;
  source: string; // Request name or identifier
  timestamp: number;
}

interface ScriptState {
  /** Variables captured from response scripts */
  responseVariables: Record<string, ResponseVariable>;

  /** Test results from the last executed script */
  lastTestResults: TestResult[];

  /** Logs from the last executed script */
  lastScriptLogs: ScriptLog[];

  /** Whether to show the script console */
  showScriptConsole: boolean;

  // Actions
  setVariable: (name: string, value: unknown, source: string) => void;
  getVariable: (name: string) => unknown;
  getAllVariables: () => Record<string, unknown>;
  clearVariable: (name: string) => void;
  clearAllVariables: () => void;
  clearVariablesFromSource: (source: string) => void;

  setTestResults: (results: TestResult[]) => void;
  clearTestResults: () => void;

  addLog: (log: ScriptLog) => void;
  setLogs: (logs: ScriptLog[]) => void;
  clearLogs: () => void;

  setShowScriptConsole: (show: boolean) => void;
}

export const useScriptStore = create<ScriptState>((set, get) => ({
  responseVariables: {},
  lastTestResults: [],
  lastScriptLogs: [],
  showScriptConsole: false,

  setVariable: (name, value, source) => {
    set((state) => {
      const newVar: ResponseVariable = {
        name,
        value,
        source,
        timestamp: Date.now(),
      };

      let newVars = { ...state.responseVariables, [name]: newVar };

      // Prune oldest variables if limit exceeded
      const varEntries = Object.entries(newVars);
      if (varEntries.length > MAX_VARIABLES) {
        varEntries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        const toRemove = varEntries.length - MAX_VARIABLES;
        for (let i = 0; i < toRemove; i++) {
          delete newVars[varEntries[i][0]];
        }
      }

      return { responseVariables: newVars };
    });
  },

  getVariable: (name) => {
    return get().responseVariables[name]?.value;
  },

  getAllVariables: () => {
    const vars: Record<string, unknown> = {};
    for (const [name, variable] of Object.entries(get().responseVariables)) {
      vars[name] = variable.value;
    }
    return vars;
  },

  clearVariable: (name) => {
    set((state) => {
      const newVars = { ...state.responseVariables };
      delete newVars[name];
      return { responseVariables: newVars };
    });
  },

  clearAllVariables: () => {
    set({ responseVariables: {} });
  },

  clearVariablesFromSource: (source) => {
    set((state) => ({
      responseVariables: Object.fromEntries(
        Object.entries(state.responseVariables).filter(
          ([_, variable]) => variable.source !== source
        )
      ),
    }));
  },

  setTestResults: (results) => {
    set({ lastTestResults: results });
  },

  clearTestResults: () => {
    set({ lastTestResults: [] });
  },

  addLog: (log) => {
    set((state) => {
      const newLogs = [...state.lastScriptLogs, log];
      // Keep only the most recent logs if limit exceeded
      if (newLogs.length > MAX_LOGS) {
        return { lastScriptLogs: newLogs.slice(-MAX_LOGS) };
      }
      return { lastScriptLogs: newLogs };
    });
  },

  setLogs: (logs) => {
    set({ lastScriptLogs: logs });
  },

  clearLogs: () => {
    set({ lastScriptLogs: [] });
  },

  setShowScriptConsole: (show) => {
    set({ showScriptConsole: show });
  },
}));
