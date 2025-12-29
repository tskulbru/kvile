//! OIDC (OpenID Connect) Authentication Support
//!
//! Implements the Authorization Code flow with PKCE for desktop applications.

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::Rng;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpListener;
use url::Url;

/// OIDC Discovery Document (OpenID Provider Configuration)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OidcDiscovery {
    pub issuer: String,
    pub authorization_endpoint: String,
    pub token_endpoint: String,
    #[serde(default)]
    pub userinfo_endpoint: Option<String>,
    #[serde(default)]
    pub jwks_uri: Option<String>,
    #[serde(default)]
    pub end_session_endpoint: Option<String>,
    #[serde(default)]
    pub scopes_supported: Vec<String>,
    #[serde(default)]
    pub response_types_supported: Vec<String>,
    #[serde(default)]
    pub grant_types_supported: Vec<String>,
}

/// OIDC Configuration for a request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OidcConfig {
    /// Issuer URL (used for discovery)
    pub issuer: Option<String>,
    /// Authorization endpoint (can be explicit or from discovery)
    pub authorization_endpoint: Option<String>,
    /// Token endpoint (can be explicit or from discovery)
    pub token_endpoint: Option<String>,
    /// Client ID
    pub client_id: String,
    /// Client Secret (optional for public clients)
    pub client_secret: Option<String>,
    /// Redirect URL (must be registered with IdP)
    pub redirect_url: String,
    /// Scopes to request
    pub scopes: Vec<String>,
    /// Additional parameters to include in auth request
    #[serde(default)]
    pub extra_params: HashMap<String, String>,
}

/// Token response from the token endpoint
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenResponse {
    pub access_token: String,
    #[serde(default)]
    pub token_type: Option<String>,
    #[serde(default)]
    pub expires_in: Option<u64>,
    #[serde(default)]
    pub refresh_token: Option<String>,
    #[serde(default)]
    pub id_token: Option<String>,
    #[serde(default)]
    pub scope: Option<String>,
}

/// PKCE (Proof Key for Code Exchange) parameters
#[derive(Debug, Clone)]
pub struct PkceParams {
    pub code_verifier: String,
    pub code_challenge: String,
    pub code_challenge_method: String,
}

/// State for an ongoing OIDC authentication flow
#[derive(Debug)]
#[allow(dead_code)]
pub struct OidcAuthState {
    pub state: String,
    pub pkce: PkceParams,
    pub config: OidcConfig,
    pub discovery: Option<OidcDiscovery>,
}

/// Result of the callback - either success with code or error
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CallbackResult {
    pub code: Option<String>,
    pub state: Option<String>,
    pub error: Option<String>,
    pub error_description: Option<String>,
}

/// Generate PKCE code verifier and challenge
pub fn generate_pkce() -> PkceParams {
    // Generate 32 random bytes for code verifier
    let mut rng = rand::thread_rng();
    let random_bytes: Vec<u8> = (0..32).map(|_| rng.gen()).collect();
    let code_verifier = URL_SAFE_NO_PAD.encode(&random_bytes);

    // Generate code challenge using SHA256
    let mut hasher = Sha256::new();
    hasher.update(code_verifier.as_bytes());
    let hash = hasher.finalize();
    let code_challenge = URL_SAFE_NO_PAD.encode(hash);

    PkceParams {
        code_verifier,
        code_challenge,
        code_challenge_method: "S256".to_string(),
    }
}

/// Generate a random state parameter
pub fn generate_state() -> String {
    let mut rng = rand::thread_rng();
    let random_bytes: Vec<u8> = (0..16).map(|_| rng.gen()).collect();
    URL_SAFE_NO_PAD.encode(&random_bytes)
}

/// Fetch OIDC discovery document from issuer
pub async fn fetch_discovery(issuer: &str) -> Result<OidcDiscovery, String> {
    let discovery_url = format!(
        "{}/.well-known/openid-configuration",
        issuer.trim_end_matches('/')
    );

    let client = reqwest::Client::new();
    let response = client
        .get(&discovery_url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch discovery document: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Discovery request failed with status: {}",
            response.status()
        ));
    }

    response
        .json::<OidcDiscovery>()
        .await
        .map_err(|e| format!("Failed to parse discovery document: {}", e))
}

/// Build the authorization URL
pub fn build_auth_url(
    config: &OidcConfig,
    discovery: Option<&OidcDiscovery>,
    state: &str,
    pkce: &PkceParams,
) -> Result<String, String> {
    let auth_endpoint = config
        .authorization_endpoint
        .as_ref()
        .or(discovery.map(|d| &d.authorization_endpoint))
        .ok_or("No authorization endpoint configured")?;

    let mut url =
        Url::parse(auth_endpoint).map_err(|e| format!("Invalid authorization endpoint: {}", e))?;

    {
        let mut params = url.query_pairs_mut();
        params.append_pair("response_type", "code");
        params.append_pair("client_id", &config.client_id);
        params.append_pair("redirect_uri", &config.redirect_url);
        params.append_pair("scope", &config.scopes.join(" "));
        params.append_pair("state", state);
        params.append_pair("code_challenge", &pkce.code_challenge);
        params.append_pair("code_challenge_method", &pkce.code_challenge_method);

        // Add any extra parameters
        for (key, value) in &config.extra_params {
            params.append_pair(key, value);
        }
    }

    Ok(url.to_string())
}

/// Start a local HTTP server to listen for the OAuth callback
pub async fn start_callback_server(
    redirect_url: &str,
    expected_state: &str,
) -> Result<CallbackResult, String> {
    // Parse the redirect URL to get host and port
    let url = Url::parse(redirect_url).map_err(|e| format!("Invalid redirect URL: {}", e))?;

    let host = url.host_str().unwrap_or("127.0.0.1");
    let port = url.port().unwrap_or(8080);
    let path = url.path();

    let bind_addr = format!("{}:{}", host, port);

    // Create TCP listener
    let listener = TcpListener::bind(&bind_addr)
        .await
        .map_err(|e| format!("Failed to bind to {}: {}", bind_addr, e))?;

    // Wait for a single connection
    let (mut socket, _) = listener
        .accept()
        .await
        .map_err(|e| format!("Failed to accept connection: {}", e))?;

    // Read the HTTP request
    let mut reader = BufReader::new(&mut socket);
    let mut request_line = String::new();
    reader
        .read_line(&mut request_line)
        .await
        .map_err(|e| format!("Failed to read request: {}", e))?;

    // Parse the request to extract query parameters
    // Request line format: "GET /callback?code=xxx&state=xxx HTTP/1.1"
    let parts: Vec<&str> = request_line.split_whitespace().collect();
    if parts.len() < 2 {
        return Err("Invalid HTTP request".to_string());
    }

    let request_path = parts[1];

    // Check if the path matches expected
    if !request_path.starts_with(path) {
        return Err(format!("Unexpected callback path: {}", request_path));
    }

    // Parse query parameters
    let callback_url = format!("http://localhost{}", request_path);
    let parsed =
        Url::parse(&callback_url).map_err(|e| format!("Failed to parse callback: {}", e))?;

    let params: HashMap<String, String> = parsed.query_pairs().into_owned().collect();

    let result = CallbackResult {
        code: params.get("code").cloned(),
        state: params.get("state").cloned(),
        error: params.get("error").cloned(),
        error_description: params.get("error_description").cloned(),
    };

    // Verify state matches
    if let Some(ref state) = result.state {
        if state != expected_state {
            return Err("State mismatch - possible CSRF attack".to_string());
        }
    }

    // Send HTTP response (success page)
    let response_body = if result.error.is_some() {
        format!(
            r#"<!DOCTYPE html>
<html>
<head><title>Authentication Failed</title></head>
<body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
<div style="text-align: center;">
<h1 style="color: #ef4444;">Authentication Failed</h1>
<p>{}</p>
<p>You can close this window.</p>
</div>
</body>
</html>"#,
            result
                .error_description
                .as_ref()
                .unwrap_or(&"Unknown error".to_string())
        )
    } else {
        r#"<!DOCTYPE html>
<html>
<head><title>Authentication Successful</title></head>
<body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
<div style="text-align: center;">
<h1 style="color: #22c55e;">Authentication Successful</h1>
<p>You can close this window and return to Kvile.</p>
</div>
</body>
</html>"#
            .to_string()
    };

    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        response_body.len(),
        response_body
    );

    // Get inner socket back and write response
    let socket = reader.into_inner();
    socket
        .write_all(response.as_bytes())
        .await
        .map_err(|e| format!("Failed to send response: {}", e))?;

    Ok(result)
}

/// Exchange authorization code for tokens
pub async fn exchange_code_for_tokens(
    config: &OidcConfig,
    discovery: Option<&OidcDiscovery>,
    code: &str,
    code_verifier: &str,
) -> Result<TokenResponse, String> {
    let token_endpoint = config
        .token_endpoint
        .as_ref()
        .or(discovery.map(|d| &d.token_endpoint))
        .ok_or("No token endpoint configured")?;

    let mut params = HashMap::new();
    params.insert("grant_type", "authorization_code");
    params.insert("code", code);
    params.insert("redirect_uri", &config.redirect_url);
    params.insert("client_id", &config.client_id);
    params.insert("code_verifier", code_verifier);

    let client = reqwest::Client::new();
    let mut request = client.post(token_endpoint).form(&params);

    // Add client secret if provided (confidential client)
    if let Some(ref secret) = config.client_secret {
        // Can either use client_secret in body or Basic auth header
        // Using body is more common
        request = client.post(token_endpoint).form(&{
            let mut p = params.clone();
            p.insert("client_secret", secret.as_str());
            p
        });
    }

    let response = request
        .send()
        .await
        .map_err(|e| format!("Token request failed: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Token exchange failed: {}", error_text));
    }

    response
        .json::<TokenResponse>()
        .await
        .map_err(|e| format!("Failed to parse token response: {}", e))
}

/// Refresh an access token using a refresh token
pub async fn refresh_access_token(
    config: &OidcConfig,
    discovery: Option<&OidcDiscovery>,
    refresh_token: &str,
) -> Result<TokenResponse, String> {
    let token_endpoint = config
        .token_endpoint
        .as_ref()
        .or(discovery.map(|d| &d.token_endpoint))
        .ok_or("No token endpoint configured")?;

    let mut params = HashMap::new();
    params.insert("grant_type", "refresh_token");
    params.insert("refresh_token", refresh_token);
    params.insert("client_id", &config.client_id);

    if let Some(ref secret) = config.client_secret {
        params.insert("client_secret", secret.as_str());
    }

    let client = reqwest::Client::new();
    let response = client
        .post(token_endpoint)
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Refresh request failed: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Token refresh failed: {}", error_text));
    }

    response
        .json::<TokenResponse>()
        .await
        .map_err(|e| format!("Failed to parse refresh response: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_pkce() {
        let pkce = generate_pkce();
        assert!(!pkce.code_verifier.is_empty());
        assert!(!pkce.code_challenge.is_empty());
        assert_eq!(pkce.code_challenge_method, "S256");
        // Verifier should be ~43 chars (32 bytes base64 encoded)
        assert!(pkce.code_verifier.len() >= 40);
    }

    #[test]
    fn test_generate_state() {
        let state = generate_state();
        assert!(!state.is_empty());
        // State should be ~22 chars (16 bytes base64 encoded)
        assert!(state.len() >= 20);
    }

    #[test]
    fn test_build_auth_url() {
        let config = OidcConfig {
            issuer: None,
            authorization_endpoint: Some("https://auth.example.com/authorize".to_string()),
            token_endpoint: Some("https://auth.example.com/token".to_string()),
            client_id: "my-client".to_string(),
            client_secret: None,
            redirect_url: "http://localhost:8080/callback".to_string(),
            scopes: vec!["openid".to_string(), "profile".to_string()],
            extra_params: HashMap::new(),
        };

        let pkce = generate_pkce();
        let state = generate_state();

        let url = build_auth_url(&config, None, &state, &pkce).unwrap();

        assert!(url.contains("response_type=code"));
        assert!(url.contains("client_id=my-client"));
        assert!(url.contains("redirect_uri="));
        assert!(url.contains("scope=openid+profile"));
        assert!(url.contains("code_challenge="));
        assert!(url.contains("code_challenge_method=S256"));
    }
}
