export type ContentType = "json" | "xml" | "html" | "text" | "binary";

/**
 * Detect content type from headers and body
 */
export function detectContentType(
  headers: Record<string, string>,
  body: string
): ContentType {
  // Normalize header keys to lowercase for lookup
  const normalizedHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    normalizedHeaders[key.toLowerCase()] = value;
  }

  const contentType = normalizedHeaders["content-type"]?.toLowerCase() || "";

  if (contentType.includes("application/json") || contentType.includes("+json")) {
    return "json";
  }

  if (contentType.includes("application/xml") || contentType.includes("text/xml") || contentType.includes("+xml")) {
    return "xml";
  }

  if (contentType.includes("text/html")) {
    return "html";
  }

  if (
    contentType.startsWith("image/") ||
    contentType.startsWith("audio/") ||
    contentType.startsWith("video/") ||
    contentType === "application/octet-stream" ||
    contentType.includes("application/pdf")
  ) {
    return "binary";
  }

  // Try to detect from content
  const trimmed = body.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      JSON.parse(trimmed);
      return "json";
    } catch {
      // Not valid JSON
    }
  }

  if (trimmed.startsWith("<?xml") || (trimmed.startsWith("<") && trimmed.includes("</") && trimmed.endsWith(">"))) {
    return "xml";
  }

  if (trimmed.toLowerCase().startsWith("<!doctype html") || trimmed.toLowerCase().startsWith("<html")) {
    return "html";
  }

  return "text";
}

/**
 * Format JSON with indentation
 */
export function formatJson(body: string): string {
  try {
    const parsed = JSON.parse(body);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return body;
  }
}

/**
 * Format XML/HTML with indentation
 */
export function formatXml(body: string): string {
  try {
    let formatted = "";
    let indent = 0;

    // Split on tags while preserving them
    const tokens = body.replace(/>\s*</g, ">\n<").split("\n");

    for (const token of tokens) {
      const trimmed = token.trim();
      if (!trimmed) continue;

      // Handle closing tags
      if (trimmed.startsWith("</")) {
        indent = Math.max(0, indent - 1);
      }

      formatted += "  ".repeat(indent) + trimmed + "\n";

      // Handle opening tags (not self-closing, not declarations, not closing)
      if (
        trimmed.startsWith("<") &&
        !trimmed.startsWith("</") &&
        !trimmed.startsWith("<?") &&
        !trimmed.startsWith("<!") &&
        !trimmed.endsWith("/>") &&
        // Check if it's not a self-contained tag (has both open and close)
        !(trimmed.includes("</") && trimmed.indexOf("</") > trimmed.indexOf(">"))
      ) {
        indent++;
      }
    }

    return formatted.trim();
  } catch {
    return body;
  }
}

/**
 * Format response body based on content type
 */
export function formatResponseBody(
  body: string,
  contentType: ContentType
): string {
  switch (contentType) {
    case "json":
      return formatJson(body);
    case "xml":
    case "html":
      return formatXml(body);
    default:
      return body;
  }
}

/**
 * Get Monaco language ID for content type
 */
export function getMonacoLanguage(contentType: ContentType): string {
  switch (contentType) {
    case "json":
      return "json";
    case "xml":
      return "xml";
    case "html":
      return "html";
    default:
      return "plaintext";
  }
}
