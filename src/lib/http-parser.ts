import { parseHttpFile, type ParsedRequest, type HttpRequest } from "./tauri";

/**
 * Find the request at the given cursor line position
 */
export async function getRequestAtCursor(
  content: string,
  cursorLine: number
): Promise<ParsedRequest | null> {
  const requests = await parseHttpFile(content);

  if (requests.length === 0) return null;

  // Find the request that contains the cursor line
  // Requests are sorted by line_number, so we find the last one
  // where line_number <= cursorLine
  for (let i = requests.length - 1; i >= 0; i--) {
    if (requests[i].line_number <= cursorLine) {
      return requests[i];
    }
  }

  // Default to first request if cursor is before all requests
  return requests[0];
}

/**
 * Convert a ParsedRequest to an HttpRequest for execution
 */
export function buildHttpRequest(parsed: ParsedRequest): HttpRequest {
  return {
    method: parsed.method,
    url: parsed.url,
    headers: parsed.headers,
    body: parsed.body,
  };
}

/**
 * Parse all requests from HTTP file content
 */
export async function parseAllRequests(content: string): Promise<ParsedRequest[]> {
  return parseHttpFile(content);
}
