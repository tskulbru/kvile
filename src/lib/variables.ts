import { resolveDynamicVariable } from "./dynamic-variables";

export interface SubstitutionResult {
  result: string;
  missingVariables: string[];
}

/**
 * Substitute all {{variable}} placeholders with values
 * Supports both regular variables and dynamic variables (starting with $)
 */
export function substituteVariables(
  input: string,
  variables: Record<string, string>
): SubstitutionResult {
  // Match both regular variables and dynamic variables with optional args
  // Examples: {{baseUrl}}, {{$uuid}}, {{$randomInt 1 100}}
  const varRegex = /\{\{(\$?[\w.-]+(?:\s+[\w.-]+)*)\}\}/g;
  const missing: string[] = [];

  const result = input.replace(varRegex, (match, varContent) => {
    // Check for dynamic variable (starts with $)
    if (varContent.startsWith("$")) {
      const parts = varContent.slice(1).split(/\s+/);
      const varName = parts[0];
      const args = parts.slice(1).join(" ") || undefined;

      const value = resolveDynamicVariable(varName, args);
      if (value !== null) {
        return value;
      }
      // Fall through to check regular variables if not a valid dynamic var
    }

    // Regular variable lookup (without $ prefix)
    const cleanName = varContent.startsWith("$") ? varContent : varContent;
    if (cleanName in variables) {
      return variables[cleanName];
    }

    missing.push(varContent);
    return match; // Keep original if not found
  });

  return { result, missingVariables: missing };
}

/**
 * Extract inline variable definitions from .http file content
 * Supports VS Code REST Client style: @varName = value
 */
export function extractInlineVariables(content: string): Record<string, string> {
  const variables: Record<string, string> = {};
  const varDefRegex = /^@([\w-]+)\s*=\s*(.*)$/gm;

  let match;
  while ((match = varDefRegex.exec(content)) !== null) {
    const [, name, value] = match;
    variables[name] = value.trim();
  }

  return variables;
}

/**
 * Find all variable references in content
 */
export function findVariableReferences(content: string): string[] {
  const varRegex = /\{\{([\w.-]+)\}\}/g;
  const variables: string[] = [];

  let match;
  while ((match = varRegex.exec(content)) !== null) {
    const varName = match[1];
    if (!variables.includes(varName)) {
      variables.push(varName);
    }
  }

  return variables;
}
