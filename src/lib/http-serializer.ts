import type { ParsedRequest } from "./tauri";

/**
 * Serialize a ParsedRequest back to .http file format
 */
export function serializeRequest(request: ParsedRequest): string {
  const lines: string[] = [];

  // Request name as comment separator (### Name)
  if (request.name) {
    lines.push(`### ${request.name}`);
  }

  // Metadata annotations (# @key value)
  if (request.metadata && Object.keys(request.metadata).length > 0) {
    for (const [key, value] of Object.entries(request.metadata)) {
      lines.push(`# @${key} ${value}`);
    }
  }

  // Request line: METHOD URL [HTTP/version]
  const httpVersion = request.http_version ? ` ${request.http_version}` : "";
  lines.push(`${request.method} ${request.url}${httpVersion}`);

  // Headers
  for (const [key, value] of Object.entries(request.headers)) {
    lines.push(`${key}: ${value}`);
  }

  // Body (with blank line separator)
  if (request.body) {
    lines.push(""); // Empty line before body
    lines.push(request.body);
  }

  return lines.join("\n");
}

/**
 * Find the start and end line numbers of a request in the source file
 * @param content The full file content
 * @param request The request to find
 * @param allRequests All parsed requests from the file
 * @returns Object with start and end line indices (0-indexed)
 */
export function findRequestBoundaries(
  content: string,
  request: ParsedRequest,
  allRequests: ParsedRequest[]
): { start: number; end: number } {
  const lines = content.split("\n");
  let startLine = request.line_number - 1; // Convert to 0-indexed (points to METHOD line)

  // Find the index of this request
  const requestIndex = allRequests.findIndex(
    (r) => r.line_number === request.line_number
  );
  const nextRequest = allRequests[requestIndex + 1];

  // Walk backwards from METHOD line to find the start of this request block
  // (includes ### separator, # @metadata, etc.)
  let searchLine = startLine - 1;
  while (searchLine >= 0) {
    const line = lines[searchLine]?.trim() || "";
    // Stop if we hit empty line (but check if ### is above it)
    if (line === "") {
      // Check if line above is ### separator
      if (searchLine > 0 && lines[searchLine - 1]?.trim().startsWith("###")) {
        startLine = searchLine - 1;
      }
      break;
    }
    // Include ### separator and # @metadata lines
    if (line.startsWith("###") || line.startsWith("# @")) {
      startLine = searchLine;
    } else {
      // Some other content, stop
      break;
    }
    searchLine--;
  }

  // For the first request, also check if file starts with ### or metadata
  if (requestIndex === 0 && startLine > 0) {
    searchLine = startLine - 1;
    while (searchLine >= 0) {
      const line = lines[searchLine]?.trim() || "";
      if (line.startsWith("###") || line.startsWith("# @") || line === "") {
        if (line !== "") startLine = searchLine;
        searchLine--;
      } else {
        break;
      }
    }
  }

  // Find the end line
  let endLine: number;
  if (nextRequest) {
    // End before the next request's block starts
    // The next request's line_number points to its METHOD line
    // We need to find where its block starts (### separator)
    let nextStart = nextRequest.line_number - 1; // 0-indexed
    searchLine = nextStart - 1;
    while (searchLine > startLine) {
      const line = lines[searchLine]?.trim() || "";
      if (line.startsWith("###") || line.startsWith("# @")) {
        nextStart = searchLine;
        searchLine--;
      } else if (line === "") {
        searchLine--;
      } else {
        break;
      }
    }
    endLine = nextStart - 1;
  } else {
    // Last request in file
    endLine = lines.length - 1;
  }

  // Trim trailing empty lines from this request's range
  while (endLine > startLine && lines[endLine].trim() === "") {
    endLine--;
  }

  return { start: startLine, end: endLine };
}

/**
 * Update a request in the source content
 * @param content The full file content
 * @param request The original request (for finding boundaries)
 * @param updatedRequest The updated request to serialize
 * @param allRequests All parsed requests from the file
 * @returns Object with updated content and new line number for the request
 */
export function updateRequestInContent(
  content: string,
  request: ParsedRequest,
  updatedRequest: ParsedRequest,
  allRequests: ParsedRequest[]
): { content: string; newLineNumber: number } {
  const boundaries = findRequestBoundaries(content, request, allRequests);
  const lines = content.split("\n");

  // Serialize the updated request
  let newRequestText = serializeRequest(updatedRequest);

  // If we had a name before but removed it, we might need to keep the separator
  // for non-first requests (The serializer adds ### if there's a name)
  const requestIndex = allRequests.findIndex(
    (r) => r.line_number === request.line_number
  );
  if (!updatedRequest.name && request.name && requestIndex > 0) {
    newRequestText = `###\n${newRequestText}`;
  }

  // Build the new content
  const before = lines.slice(0, boundaries.start).join("\n");
  const after = lines.slice(boundaries.end + 1).join("\n");

  // Combine parts, handling edge cases for empty before/after
  const parts: string[] = [];
  if (before) {
    parts.push(before);
  }
  parts.push(newRequestText);
  if (after) {
    parts.push(after);
  }

  const newContent = parts.join("\n");

  // Calculate the new line number for the METHOD line
  // Count lines in 'before' section + lines until METHOD in serialized text
  const beforeLineCount = before ? before.split("\n").length : 0;
  const serializedLines = newRequestText.split("\n");
  let methodLineOffset = 0;
  for (let i = 0; i < serializedLines.length; i++) {
    const line = serializedLines[i].trim();
    // Find the METHOD URL line
    if (/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|TRACE|CONNECT)\s+/.test(line)) {
      methodLineOffset = i;
      break;
    }
  }

  // New line number is 1-indexed
  const newLineNumber = beforeLineCount + methodLineOffset + 1;

  return { content: newContent, newLineNumber };
}
