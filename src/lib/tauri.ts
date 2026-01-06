import { invoke } from "@tauri-apps/api/core";

/**
 * Check if running in Tauri context
 */
export function isTauriAvailable(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Wrapper for Tauri invoke with consistent error handling
 */
async function invokeWithErrorHandling<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T> {
  if (!isTauriAvailable()) {
    throw new Error("Not running in Tauri context");
  }
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    console.error(`Tauri command "${command}" failed:`, error);
    throw new Error(typeof error === "string" ? error : `Command ${command} failed`);
  }
}

export interface HttpRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export interface HttpResponse {
  status: number;
  status_text: string;
  headers: Record<string, string>;
  body: string;
  time: number;
  size: number;
}

export interface ParsedRequest {
  name?: string;
  method: string;
  url: string;
  http_version?: string;
  headers: Record<string, string>;
  body?: string;
  line_number: number;
  variables: Record<string, string>;
  metadata: Record<string, string>;
  pre_script?: string;
  post_script?: string;
}

export interface FileInfo {
  path: string;
  name: string;
  is_http_file: boolean;
}

export interface Environment {
  name: string;
  variables: Record<string, string>;
  private_variables: Record<string, string>;
  source_file: string;
}

export interface EnvironmentConfig {
  environments: Environment[];
  shared: Record<string, string>;
  private_shared: Record<string, string>;
}

/**
 * Send an HTTP request via the Tauri backend
 */
export async function sendRequest(request: HttpRequest): Promise<HttpResponse> {
  return invokeWithErrorHandling<HttpResponse>("send_request", { request });
}

/**
 * Parse an HTTP file content and return all requests
 */
export async function parseHttpFile(content: string): Promise<ParsedRequest[]> {
  return invokeWithErrorHandling<ParsedRequest[]>("parse_http_file", { content });
}

/**
 * Read a file from the filesystem
 */
export async function readFile(path: string): Promise<string> {
  return invokeWithErrorHandling<string>("read_file", { path });
}

/**
 * Write content to a file
 */
export async function writeFile(path: string, content: string): Promise<void> {
  return invokeWithErrorHandling<void>("write_file", { path, content });
}

/**
 * List all HTTP files in a directory recursively
 */
export async function listHttpFiles(directory: string): Promise<FileInfo[]> {
  return invokeWithErrorHandling<FileInfo[]>("list_http_files", { directory });
}

/**
 * Start watching a directory for file changes
 */
export async function startWatching(directory: string): Promise<void> {
  return invokeWithErrorHandling<void>("start_watching", { directory });
}

/**
 * Stop watching the current directory
 */
export async function stopWatching(): Promise<void> {
  return invokeWithErrorHandling<void>("stop_watching", {});
}

/**
 * Load environment configuration from workspace
 */
export async function loadEnvironmentConfig(
  workspace: string
): Promise<EnvironmentConfig> {
  return invokeWithErrorHandling<EnvironmentConfig>("load_environment_config", {
    workspace,
  });
}

/**
 * Save or update an environment in the workspace
 */
export async function saveEnvironment(
  workspace: string,
  envName: string,
  variables: Record<string, string>,
  isPrivate: boolean
): Promise<void> {
  return invokeWithErrorHandling<void>("save_environment", {
    workspace,
    envName,
    variables,
    isPrivate,
  });
}

/**
 * Get file extension based on content type
 */
function getExtensionForContentType(contentType: string): string {
  const ct = contentType.toLowerCase();
  if (ct.includes("json")) return ".json";
  if (ct.includes("xml")) return ".xml";
  if (ct.includes("html")) return ".html";
  if (ct.includes("image/png")) return ".png";
  if (ct.includes("image/jpeg") || ct.includes("image/jpg")) return ".jpg";
  if (ct.includes("image/gif")) return ".gif";
  if (ct.includes("image/svg")) return ".svg";
  if (ct.includes("pdf")) return ".pdf";
  if (ct.includes("javascript")) return ".js";
  if (ct.includes("css")) return ".css";
  if (ct.includes("csv")) return ".csv";
  return ".txt";
}

/**
 * Save response body to a file using native save dialog
 */
export async function saveResponseToFile(
  body: string,
  contentType: string,
  suggestedName?: string
): Promise<string | null> {
  if (!isTauriAvailable()) {
    throw new Error("Not running in Tauri context");
  }

  // Dynamic import to avoid issues when not in Tauri
  const { save } = await import("@tauri-apps/plugin-dialog");

  const extension = getExtensionForContentType(contentType);
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
  const defaultName = suggestedName || `response_${timestamp}${extension}`;

  const path = await save({
    defaultPath: defaultName,
    filters: [
      { name: "All Files", extensions: ["*"] },
      { name: "JSON", extensions: ["json"] },
      { name: "XML", extensions: ["xml"] },
      { name: "HTML", extensions: ["html"] },
      { name: "Text", extensions: ["txt"] },
    ],
  });

  if (path) {
    await writeFile(path, body);
    return path;
  }

  return null;
}

// ===== HISTORY API =====

export interface HistoryEntry {
  id: number;
  timestamp: string;
  workspace: string;
  file_path?: string;
  request_name?: string;
  method: string;
  url: string;
  request_headers: string; // JSON string
  request_body?: string;
  status: number;
  status_text: string;
  response_headers: string; // JSON string
  response_body: string;
  duration_ms: number;
  response_size: number;
}

export interface NewHistoryEntry {
  workspace: string;
  file_path?: string;
  request_name?: string;
  method: string;
  url: string;
  request_headers: string; // JSON string
  request_body?: string;
  status: number;
  status_text: string;
  response_headers: string; // JSON string
  response_body: string;
  duration_ms: number;
  response_size: number;
}

/**
 * Get history entries for a workspace
 */
export async function getHistory(
  workspace: string,
  limit?: number
): Promise<HistoryEntry[]> {
  return invokeWithErrorHandling<HistoryEntry[]>("get_history", {
    workspace,
    limit,
  });
}

/**
 * Get a single history entry by ID
 */
export async function getHistoryEntry(id: number): Promise<HistoryEntry | null> {
  return invokeWithErrorHandling<HistoryEntry | null>("get_history_entry", {
    id,
  });
}

/**
 * Add a new history entry
 */
export async function addHistoryEntry(entry: NewHistoryEntry): Promise<number> {
  return invokeWithErrorHandling<number>("add_history_entry", { entry });
}

/**
 * Delete a history entry by ID
 */
export async function deleteHistoryEntry(id: number): Promise<boolean> {
  return invokeWithErrorHandling<boolean>("delete_history_entry", { id });
}

/**
 * Clear all history for a workspace
 */
export async function clearHistory(workspace: string): Promise<number> {
  return invokeWithErrorHandling<number>("clear_history", { workspace });
}

// ===== IMPORT API =====

/**
 * Convert a cURL command to HTTP file format
 */
export async function convertCurlToHttp(curlCommand: string): Promise<string> {
  return invokeWithErrorHandling<string>("convert_curl_to_http", {
    curlCommand,
  });
}

// ===== OIDC API =====

export interface OidcDiscovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
  jwks_uri?: string;
  end_session_endpoint?: string;
  scopes_supported: string[];
  response_types_supported: string[];
  grant_types_supported: string[];
}

export interface OidcConfig {
  issuer?: string;
  authorization_endpoint?: string;
  token_endpoint?: string;
  client_id: string;
  client_secret?: string;
  redirect_url: string;
  scopes: string[];
  extra_params?: Record<string, string>;
}

export interface OidcAuthStartResult {
  auth_url: string;
  state: string;
  code_verifier: string;
}

export interface OidcTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
}

/**
 * Fetch OIDC discovery document from issuer
 */
export async function oidcDiscover(issuer: string): Promise<OidcDiscovery> {
  return invokeWithErrorHandling<OidcDiscovery>("oidc_discover", { issuer });
}

/**
 * Start OIDC auth flow - returns auth URL to open in browser
 */
export async function oidcStartAuth(config: OidcConfig): Promise<OidcAuthStartResult> {
  return invokeWithErrorHandling<OidcAuthStartResult>("oidc_start_auth", { config });
}

/**
 * Wait for OIDC callback on localhost - returns authorization code
 */
export async function oidcWaitForCallback(
  redirectUrl: string,
  expectedState: string
): Promise<string> {
  return invokeWithErrorHandling<string>("oidc_wait_for_callback", {
    redirectUrl,
    expectedState,
  });
}

/**
 * Exchange authorization code for tokens
 */
export async function oidcExchangeCode(
  config: OidcConfig,
  code: string,
  codeVerifier: string
): Promise<OidcTokenResponse> {
  return invokeWithErrorHandling<OidcTokenResponse>("oidc_exchange_code", {
    config,
    code,
    codeVerifier,
  });
}

/**
 * Refresh an OIDC access token
 */
export async function oidcRefreshToken(
  config: OidcConfig,
  refreshToken: string
): Promise<OidcTokenResponse> {
  return invokeWithErrorHandling<OidcTokenResponse>("oidc_refresh_token", {
    config,
    refreshToken,
  });
}
