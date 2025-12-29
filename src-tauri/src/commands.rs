use crate::history::{HistoryDb, HistoryEntry, NewHistoryEntry};
use crate::http_client::{execute_request, HttpRequest, HttpResponse};
use crate::parser::{parse_http_content, ParsedRequest};
use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
pub struct FileInfo {
    pub path: String,
    pub name: String,
    pub is_http_file: bool,
}

/// Send an HTTP request and return the response
#[tauri::command]
pub async fn send_request(request: HttpRequest) -> Result<HttpResponse, String> {
    execute_request(request).await.map_err(|e| e.to_string())
}

/// Parse an HTTP file and return all requests found in it
#[tauri::command]
pub async fn parse_http_file(content: String) -> Result<Vec<ParsedRequest>, String> {
    parse_http_content(&content).map_err(|e| e.to_string())
}

/// Read a file from the filesystem
#[tauri::command]
pub async fn read_file(path: String) -> Result<String, String> {
    tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Failed to read file: {}", e))
}

/// Write content to a file
#[tauri::command]
pub async fn write_file(path: String, content: String) -> Result<(), String> {
    tokio::fs::write(&path, &content)
        .await
        .map_err(|e| format!("Failed to write file: {}", e))
}

/// List all .http and .rest files in a directory recursively
#[tauri::command]
pub async fn list_http_files(directory: String) -> Result<Vec<FileInfo>, String> {
    let mut files = Vec::new();
    list_http_files_recursive(Path::new(&directory), &mut files).await?;
    Ok(files)
}

async fn list_http_files_recursive(dir: &Path, files: &mut Vec<FileInfo>) -> Result<(), String> {
    let mut entries = tokio::fs::read_dir(dir)
        .await
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    while let Some(entry) = entries
        .next_entry()
        .await
        .map_err(|e| format!("Failed to read entry: {}", e))?
    {
        let path = entry.path();
        let metadata = entry
            .metadata()
            .await
            .map_err(|e| format!("Failed to get metadata: {}", e))?;

        if metadata.is_dir() {
            // Skip hidden directories and common non-relevant directories
            let name = path.file_name().unwrap_or_default().to_string_lossy();
            if !name.starts_with('.') && name != "node_modules" && name != "target" {
                Box::pin(list_http_files_recursive(&path, files)).await?;
            }
        } else if metadata.is_file() {
            let name = path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            let is_http_file = name.ends_with(".http") || name.ends_with(".rest");

            files.push(FileInfo {
                path: path.to_string_lossy().to_string(),
                name,
                is_http_file,
            });
        }
    }

    Ok(())
}

// ===== HISTORY COMMANDS =====

/// Get history entries for a workspace
#[tauri::command]
pub async fn get_history(
    workspace: String,
    limit: Option<i32>,
    history_db: State<'_, HistoryDb>,
) -> Result<Vec<HistoryEntry>, String> {
    let limit = limit.unwrap_or(100);
    history_db
        .get_entries(&workspace, limit)
        .map_err(|e| format!("Failed to get history: {}", e))
}

/// Get a single history entry by ID
#[tauri::command]
pub async fn get_history_entry(
    id: i64,
    history_db: State<'_, HistoryDb>,
) -> Result<Option<HistoryEntry>, String> {
    history_db
        .get_entry(id)
        .map_err(|e| format!("Failed to get history entry: {}", e))
}

/// Add a new history entry
#[tauri::command]
pub async fn add_history_entry(
    entry: NewHistoryEntry,
    history_db: State<'_, HistoryDb>,
) -> Result<i64, String> {
    history_db
        .add_entry(entry)
        .map_err(|e| format!("Failed to add history entry: {}", e))
}

/// Delete a history entry by ID
#[tauri::command]
pub async fn delete_history_entry(
    id: i64,
    history_db: State<'_, HistoryDb>,
) -> Result<bool, String> {
    history_db
        .delete_entry(id)
        .map_err(|e| format!("Failed to delete history entry: {}", e))
}

/// Clear all history for a workspace
#[tauri::command]
pub async fn clear_history(
    workspace: String,
    history_db: State<'_, HistoryDb>,
) -> Result<usize, String> {
    history_db
        .clear_workspace(&workspace)
        .map_err(|e| format!("Failed to clear history: {}", e))
}

// ===== IMPORT COMMANDS =====

/// Convert a cURL command to HTTP file format
#[tauri::command]
pub async fn convert_curl_to_http(curl_command: String) -> Result<String, String> {
    use crate::curl::{curl_to_http, parse_curl};

    let cmd = parse_curl(&curl_command)?;
    Ok(curl_to_http(&cmd))
}

// ===== OIDC COMMANDS =====

use crate::oidc::{
    build_auth_url, exchange_code_for_tokens, fetch_discovery, generate_pkce, generate_state,
    refresh_access_token, start_callback_server, OidcConfig, OidcDiscovery, TokenResponse,
};

/// OIDC Discovery - fetch the openid-configuration document
#[tauri::command]
pub async fn oidc_discover(issuer: String) -> Result<OidcDiscovery, String> {
    fetch_discovery(&issuer).await
}

/// Start OIDC login flow - returns auth URL and state for verification
#[derive(Debug, Serialize, Deserialize)]
pub struct OidcAuthStartResult {
    pub auth_url: String,
    pub state: String,
    pub code_verifier: String,
}

#[tauri::command]
pub async fn oidc_start_auth(config: OidcConfig) -> Result<OidcAuthStartResult, String> {
    // Fetch discovery if issuer is provided
    let discovery = if let Some(ref issuer) = config.issuer {
        Some(fetch_discovery(issuer).await?)
    } else {
        None
    };

    // Generate PKCE and state
    let pkce = generate_pkce();
    let state = generate_state();

    // Build authorization URL
    let auth_url = build_auth_url(&config, discovery.as_ref(), &state, &pkce)?;

    Ok(OidcAuthStartResult {
        auth_url,
        state,
        code_verifier: pkce.code_verifier,
    })
}

/// Wait for OIDC callback on localhost
#[tauri::command]
pub async fn oidc_wait_for_callback(
    redirect_url: String,
    expected_state: String,
) -> Result<String, String> {
    let result = start_callback_server(&redirect_url, &expected_state).await?;

    if let Some(error) = result.error {
        let desc = result.error_description.unwrap_or_default();
        return Err(format!("{}: {}", error, desc));
    }

    result
        .code
        .ok_or_else(|| "No authorization code received".to_string())
}

/// Exchange authorization code for tokens
#[tauri::command]
pub async fn oidc_exchange_code(
    config: OidcConfig,
    code: String,
    code_verifier: String,
) -> Result<TokenResponse, String> {
    // Fetch discovery if needed
    let discovery = if let Some(ref issuer) = config.issuer {
        Some(fetch_discovery(issuer).await?)
    } else {
        None
    };

    exchange_code_for_tokens(&config, discovery.as_ref(), &code, &code_verifier).await
}

/// Refresh an access token
#[tauri::command]
pub async fn oidc_refresh_token(
    config: OidcConfig,
    refresh_token: String,
) -> Result<TokenResponse, String> {
    // Fetch discovery if needed
    let discovery = if let Some(ref issuer) = config.issuer {
        Some(fetch_discovery(issuer).await?)
    } else {
        None
    };

    refresh_access_token(&config, discovery.as_ref(), &refresh_token).await
}
