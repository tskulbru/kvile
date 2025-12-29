/**
 * Script Runtime for Pre/Post Request Scripts
 *
 * Provides the execution environment for JetBrains-style response handlers
 * and pre-request scripts.
 */

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export interface ScriptLog {
  level: 'log' | 'warn' | 'error';
  message: string;
  timestamp: number;
}

export interface ExecutionResult {
  success: boolean;
  error?: string;
  tests: TestResult[];
  logs: ScriptLog[];
  /** Variables set during script execution */
  variables: Record<string, unknown>;
}

export interface ResponseContext {
  body: unknown;
  headers: Record<string, string>;
  status: number;
  time: number;
}

export interface RequestContext {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
  variables: {
    get: (name: string) => unknown;
    set: (name: string, value: unknown) => void;
  };
}

// Built-in utility functions available in scripts
const builtins = {
  // UUID generation
  uuid: (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback for older environments
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  },

  // Timestamps
  timestamp: (): number => Date.now(),
  isoTimestamp: (): string => new Date().toISOString(),

  // Random values
  randomInt: (min: number, max: number): number => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },
  randomFloat: (min: number, max: number): number => {
    return Math.random() * (max - min) + min;
  },
  randomString: (length: number): string => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  },
  randomHex: (length: number): string => {
    const chars = '0123456789abcdef';
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  },

  // Base64 encoding/decoding (browser environment)
  btoa: (str: string): string => window.btoa(str),
  atob: (str: string): string => window.atob(str),

  // JSON helpers
  jsonStringify: (obj: unknown): string => JSON.stringify(obj),
  jsonParse: (str: string): unknown => JSON.parse(str),
};

/**
 * Try to parse a string as JSON, returning the original string if it fails
 */
function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/**
 * Execute a post-request (response handler) script
 */
export function executePostRequestScript(
  script: string,
  response: ResponseContext,
  existingVariables: Record<string, unknown> = {}
): ExecutionResult {
  const tests: TestResult[] = [];
  const logs: ScriptLog[] = [];
  const variables: Record<string, unknown> = { ...existingVariables };

  // Create the client object
  const client = {
    global: {
      get: (name: string): unknown => variables[name],
      set: (name: string, value: unknown): void => {
        variables[name] = value;
      },
      clear: (name: string): void => {
        delete variables[name];
      },
      clearAll: (): void => {
        Object.keys(variables).forEach(key => delete variables[key]);
      },
    },
    test: (name: string, fn: () => void): void => {
      try {
        fn();
        tests.push({ name, passed: true });
      } catch (e) {
        tests.push({ name, passed: false, error: String(e) });
      }
    },
    assert: (condition: boolean, message?: string): void => {
      if (!condition) {
        throw new Error(message || 'Assertion failed');
      }
    },
    log: (...args: unknown[]): void => {
      logs.push({
        level: 'log',
        message: args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' '),
        timestamp: Date.now(),
      });
    },
  };

  // Create the response object with parsed body
  const responseObj = {
    body: typeof response.body === 'string' ? tryParseJson(response.body) : response.body,
    headers: response.headers,
    status: response.status,
    time: response.time,
  };

  try {
    // Create a function with the script and execute it
    // Provide builtins, client, and response in scope
    const fn = new Function(
      'client',
      'response',
      '$uuid',
      '$timestamp',
      '$isoTimestamp',
      '$randomInt',
      '$randomFloat',
      '$randomString',
      '$randomHex',
      '$btoa',
      '$atob',
      script
    );

    fn(
      client,
      responseObj,
      builtins.uuid,
      builtins.timestamp,
      builtins.isoTimestamp,
      builtins.randomInt,
      builtins.randomFloat,
      builtins.randomString,
      builtins.randomHex,
      builtins.btoa,
      builtins.atob
    );

    return { success: true, tests, logs, variables };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
      tests,
      logs,
      variables,
    };
  }
}

/**
 * Execute a pre-request script
 */
export function executePreRequestScript(
  script: string,
  request: Omit<RequestContext, 'variables'>,
  existingVariables: Record<string, unknown> = {}
): ExecutionResult {
  const tests: TestResult[] = [];
  const logs: ScriptLog[] = [];
  const variables: Record<string, unknown> = { ...existingVariables };

  // Create the request object with variable access
  const requestObj: RequestContext = {
    ...request,
    body: typeof request.body === 'string' ? tryParseJson(request.body) : request.body,
    variables: {
      get: (name: string): unknown => variables[name],
      set: (name: string, value: unknown): void => {
        variables[name] = value;
      },
    },
  };

  // Create a limited client for pre-request scripts
  const client = {
    global: {
      get: (name: string): unknown => variables[name],
      set: (name: string, value: unknown): void => {
        variables[name] = value;
      },
    },
    log: (...args: unknown[]): void => {
      logs.push({
        level: 'log',
        message: args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' '),
        timestamp: Date.now(),
      });
    },
  };

  try {
    const fn = new Function(
      'request',
      'client',
      '$uuid',
      '$timestamp',
      '$isoTimestamp',
      '$randomInt',
      '$randomFloat',
      '$randomString',
      '$randomHex',
      '$btoa',
      '$atob',
      script
    );

    fn(
      requestObj,
      client,
      builtins.uuid,
      builtins.timestamp,
      builtins.isoTimestamp,
      builtins.randomInt,
      builtins.randomFloat,
      builtins.randomString,
      builtins.randomHex,
      builtins.btoa,
      builtins.atob
    );

    return { success: true, tests, logs, variables };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
      tests,
      logs,
      variables,
    };
  }
}
