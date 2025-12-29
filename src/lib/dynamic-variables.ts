/**
 * Dynamic variable generators for .http files
 * These variables are resolved fresh on each request execution
 */

type DynamicVariableGenerator = (args?: string) => string;

const dynamicVariables: Record<string, DynamicVariableGenerator> = {
  // UUIDs
  uuid: () => crypto.randomUUID(),
  guid: () => crypto.randomUUID(),

  // Timestamps
  timestamp: () => Math.floor(Date.now() / 1000).toString(),
  timestampMs: () => Date.now().toString(),
  isoTimestamp: () => new Date().toISOString(),
  date: () => new Date().toISOString().split("T")[0],
  time: () => new Date().toISOString().split("T")[1].split(".")[0],

  // Random numbers
  randomInt: (args) => {
    if (args) {
      const parts = args.trim().split(/\s+/);
      const min = parseInt(parts[0], 10);
      const max = parseInt(parts[1], 10);
      if (!isNaN(min) && !isNaN(max) && max >= min) {
        return Math.floor(Math.random() * (max - min + 1) + min).toString();
      }
    }
    return Math.floor(Math.random() * 1001).toString();
  },

  randomFloat: (args) => {
    if (args) {
      const parts = args.trim().split(/\s+/);
      const min = parseFloat(parts[0]);
      const max = parseFloat(parts[1]);
      if (!isNaN(min) && !isNaN(max) && max >= min) {
        return (Math.random() * (max - min) + min).toFixed(2);
      }
    }
    return Math.random().toFixed(4);
  },

  // Random strings
  randomString: (args) => {
    const length = args ? parseInt(args.trim(), 10) : 10;
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    return Array.from({ length: isNaN(length) ? 10 : Math.min(length, 100) }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join("");
  },

  randomAlpha: (args) => {
    const length = args ? parseInt(args.trim(), 10) : 10;
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    return Array.from({ length: isNaN(length) ? 10 : Math.min(length, 100) }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join("");
  },

  randomHex: (args) => {
    const length = args ? parseInt(args.trim(), 10) : 16;
    const chars = "0123456789abcdef";
    return Array.from({ length: isNaN(length) ? 16 : Math.min(length, 100) }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join("");
  },

  // Random user data
  randomEmail: () => {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    const local = Array.from({ length: 10 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join("");
    return `${local}@example.com`;
  },

  randomFirstName: () => {
    const names = [
      "John", "Jane", "Alex", "Sarah", "Michael", "Emma",
      "David", "Lisa", "James", "Emily", "Robert", "Anna",
    ];
    return names[Math.floor(Math.random() * names.length)];
  },

  randomLastName: () => {
    const names = [
      "Smith", "Johnson", "Williams", "Brown", "Jones", "Davis",
      "Miller", "Wilson", "Moore", "Taylor", "Anderson", "Thomas",
    ];
    return names[Math.floor(Math.random() * names.length)];
  },

  randomFullName: () => {
    const firstNames = ["John", "Jane", "Alex", "Sarah", "Michael", "Emma"];
    const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Davis"];
    return `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
  },

  randomPhone: () => {
    const num = Math.floor(Math.random() * 9000000000) + 1000000000;
    return `+1${num}`;
  },

  // Booleans
  randomBoolean: () => (Math.random() > 0.5).toString(),

  // Lorem ipsum
  loremWord: () => {
    const words = [
      "lorem", "ipsum", "dolor", "sit", "amet", "consectetur",
      "adipiscing", "elit", "sed", "do", "eiusmod", "tempor",
    ];
    return words[Math.floor(Math.random() * words.length)];
  },

  loremSentence: () => {
    const words = [
      "lorem", "ipsum", "dolor", "sit", "amet", "consectetur",
      "adipiscing", "elit", "sed", "do", "eiusmod", "tempor",
      "incididunt", "ut", "labore", "et", "dolore", "magna", "aliqua",
    ];
    const length = Math.floor(Math.random() * 8) + 5;
    const sentence = Array.from({ length }, () =>
      words[Math.floor(Math.random() * words.length)]
    ).join(" ");
    return sentence.charAt(0).toUpperCase() + sentence.slice(1) + ".";
  },

  // === Authentication Helpers ===

  // Basic Auth: {{$basicAuth username password}}
  // Returns the full "Basic <base64>" value for Authorization header
  basicAuth: (args) => {
    if (!args) {
      throw new Error("$basicAuth requires username and password arguments");
    }
    const parts = args.trim().split(/\s+/);
    if (parts.length < 2) {
      throw new Error("$basicAuth requires both username and password");
    }
    const [username, ...passwordParts] = parts;
    const password = passwordParts.join(" "); // Allow spaces in password
    const credentials = `${username}:${password}`;
    return `Basic ${btoa(credentials)}`;
  },

  // Base64 encoding: {{$base64 string to encode}}
  base64: (args) => {
    if (!args) {
      return "";
    }
    return btoa(args);
  },

  // Base64 decoding: {{$base64Decode encoded_string}}
  base64Decode: (args) => {
    if (!args) {
      return "";
    }
    try {
      return atob(args.trim());
    } catch {
      return "[invalid base64]";
    }
  },

  // URL encoding: {{$urlEncode string to encode}}
  urlEncode: (args) => {
    if (!args) {
      return "";
    }
    return encodeURIComponent(args);
  },

  // URL decoding: {{$urlDecode encoded%20string}}
  urlDecode: (args) => {
    if (!args) {
      return "";
    }
    try {
      return decodeURIComponent(args.trim());
    } catch {
      return "[invalid url encoding]";
    }
  },
};

/**
 * Resolve a dynamic variable by name
 * @param name Variable name without the $ prefix
 * @param args Optional arguments string
 * @returns Resolved value or null if not a valid dynamic variable
 */
export function resolveDynamicVariable(name: string, args?: string): string | null {
  const generator = dynamicVariables[name];
  if (generator) {
    return generator(args);
  }
  return null;
}

/**
 * Check if a variable name refers to a dynamic variable
 * @param name Variable name (may or may not start with $)
 */
export function isDynamicVariable(name: string): boolean {
  const cleanName = name.startsWith("$") ? name.slice(1).split(/\s/)[0] : name;
  return cleanName in dynamicVariables;
}

/**
 * Get list of all available dynamic variables with descriptions
 */
export function getDynamicVariablesList(): Array<{ name: string; description: string }> {
  return [
    // UUIDs
    { name: "$uuid", description: "Generate UUID v4" },
    { name: "$guid", description: "Generate UUID v4 (alias)" },
    // Timestamps
    { name: "$timestamp", description: "Unix timestamp (seconds)" },
    { name: "$timestampMs", description: "Unix timestamp (milliseconds)" },
    { name: "$isoTimestamp", description: "ISO 8601 date-time" },
    { name: "$date", description: "Current date (YYYY-MM-DD)" },
    { name: "$time", description: "Current time (HH:MM:SS)" },
    // Random numbers
    { name: "$randomInt", description: "Random integer 0-1000" },
    { name: "$randomInt min max", description: "Random integer in range" },
    { name: "$randomFloat", description: "Random float 0-1" },
    // Random strings
    { name: "$randomString", description: "Random alphanumeric (10 chars)" },
    { name: "$randomString length", description: "Random alphanumeric of length" },
    { name: "$randomAlpha", description: "Random letters only" },
    { name: "$randomHex", description: "Random hex string" },
    // Random user data
    { name: "$randomEmail", description: "Random email address" },
    { name: "$randomFirstName", description: "Random first name" },
    { name: "$randomLastName", description: "Random last name" },
    { name: "$randomFullName", description: "Random full name" },
    { name: "$randomPhone", description: "Random phone number" },
    { name: "$randomBoolean", description: "Random true/false" },
    // Lorem ipsum
    { name: "$loremWord", description: "Random lorem ipsum word" },
    { name: "$loremSentence", description: "Random lorem ipsum sentence" },
    // Authentication
    { name: "$basicAuth user pass", description: "Basic Auth header value" },
    // Encoding utilities
    { name: "$base64 text", description: "Base64 encode text" },
    { name: "$base64Decode b64", description: "Base64 decode" },
    { name: "$urlEncode text", description: "URL encode text" },
    { name: "$urlDecode text", description: "URL decode text" },
  ];
}
