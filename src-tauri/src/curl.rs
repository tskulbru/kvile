use base64::{engine::general_purpose::STANDARD, Engine as _};
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct CurlCommand {
    pub method: String,
    pub url: String,
    pub headers: HashMap<String, String>,
    pub body: Option<String>,
    pub auth: Option<(String, String)>,
    pub flags: Vec<String>,
}

impl Default for CurlCommand {
    fn default() -> Self {
        Self {
            method: "GET".to_string(),
            url: String::new(),
            headers: HashMap::new(),
            body: None,
            auth: None,
            flags: Vec::new(),
        }
    }
}

/// Parse a cURL command string into structured components
pub fn parse_curl(input: &str) -> Result<CurlCommand, String> {
    // Normalize input: handle line continuations and quotes
    let normalized = normalize_curl_input(input);
    let tokens = tokenize(&normalized)?;

    if tokens.is_empty() {
        return Err("Empty cURL command".to_string());
    }

    let mut cmd = CurlCommand::default();
    let mut i = 0;

    while i < tokens.len() {
        let token = &tokens[i];

        match token.as_str() {
            "curl" => {} // Skip command name
            "-X" | "--request" => {
                i += 1;
                if i < tokens.len() {
                    cmd.method = tokens[i].to_uppercase();
                }
            }
            "-H" | "--header" => {
                i += 1;
                if i < tokens.len() {
                    if let Some((key, value)) = parse_header(&tokens[i]) {
                        cmd.headers.insert(key, value);
                    }
                }
            }
            "-d" | "--data" | "--data-raw" => {
                i += 1;
                if i < tokens.len() {
                    cmd.body = Some(tokens[i].clone());
                    // Default to POST if no method specified
                    if cmd.method == "GET" {
                        cmd.method = "POST".to_string();
                    }
                }
            }
            "--data-binary" => {
                i += 1;
                if i < tokens.len() {
                    let data = &tokens[i];
                    if let Some(path) = data.strip_prefix('@') {
                        cmd.body = Some(format!("< {}", path));
                    } else {
                        cmd.body = Some(data.clone());
                    }
                    if cmd.method == "GET" {
                        cmd.method = "POST".to_string();
                    }
                }
            }
            "--data-urlencode" => {
                i += 1;
                if i < tokens.len() {
                    // URL encode the data
                    let encoded = urlencoding::encode(&tokens[i]);
                    if let Some(existing) = &cmd.body {
                        cmd.body = Some(format!("{}&{}", existing, encoded));
                    } else {
                        cmd.body = Some(encoded.into_owned());
                    }
                    if cmd.method == "GET" {
                        cmd.method = "POST".to_string();
                    }
                }
            }
            "-u" | "--user" => {
                i += 1;
                if i < tokens.len() {
                    let parts: Vec<_> = tokens[i].splitn(2, ':').collect();
                    if parts.len() == 2 {
                        cmd.auth = Some((parts[0].to_string(), parts[1].to_string()));
                    } else if !parts.is_empty() {
                        // Password might be empty
                        cmd.auth = Some((parts[0].to_string(), String::new()));
                    }
                }
            }
            "-A" | "--user-agent" => {
                i += 1;
                if i < tokens.len() {
                    cmd.headers
                        .insert("User-Agent".to_string(), tokens[i].clone());
                }
            }
            "-b" | "--cookie" => {
                i += 1;
                if i < tokens.len() {
                    cmd.headers.insert("Cookie".to_string(), tokens[i].clone());
                }
            }
            "-e" | "--referer" => {
                i += 1;
                if i < tokens.len() {
                    cmd.headers.insert("Referer".to_string(), tokens[i].clone());
                }
            }
            "-L" | "--location" => {
                cmd.flags.push("follow-redirects".to_string());
            }
            "-k" | "--insecure" => {
                cmd.flags.push("insecure".to_string());
            }
            "--compressed" => {
                cmd.flags.push("compressed".to_string());
                // Add Accept-Encoding if not present
                if !cmd.headers.contains_key("Accept-Encoding") {
                    cmd.headers
                        .insert("Accept-Encoding".to_string(), "gzip, deflate".to_string());
                }
            }
            "-v" | "--verbose" => {
                // Ignore verbose flag
            }
            "-s" | "--silent" => {
                // Ignore silent flag
            }
            "-o" | "--output" => {
                // Skip output file argument
                i += 1;
            }
            _ if !token.starts_with('-') && cmd.url.is_empty() => {
                cmd.url = token.clone();
            }
            _ if token.starts_with("http://") || token.starts_with("https://") => {
                // URL might come before options
                cmd.url = token.clone();
            }
            _ => {
                // Unknown option, skip
            }
        }

        i += 1;
    }

    if cmd.url.is_empty() {
        return Err("No URL found in cURL command".to_string());
    }

    Ok(cmd)
}

/// Normalize cURL input by removing line continuations and collapsing whitespace
fn normalize_curl_input(input: &str) -> String {
    // Remove line continuations (\ at end of line)
    let without_continuations = input
        .replace("\\\r\n", " ")
        .replace("\\\n", " ")
        .replace("\\", " "); // Handle backslash without newline

    // Don't collapse all whitespace - just normalize line endings
    without_continuations
        .lines()
        .map(|l| l.trim())
        .collect::<Vec<_>>()
        .join(" ")
}

/// Tokenize the cURL command respecting quotes
fn tokenize(input: &str) -> Result<Vec<String>, String> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    let mut quote_char = ' ';
    let mut escape_next = false;

    for ch in input.chars() {
        if escape_next {
            current.push(ch);
            escape_next = false;
            continue;
        }

        if ch == '\\' && in_quotes {
            escape_next = true;
            continue;
        }

        if ch == '"' || ch == '\'' {
            if in_quotes && ch == quote_char {
                in_quotes = false;
            } else if !in_quotes {
                in_quotes = true;
                quote_char = ch;
            } else {
                current.push(ch);
            }
            continue;
        }

        if ch == ' ' && !in_quotes {
            if !current.is_empty() {
                tokens.push(current.clone());
                current.clear();
            }
        } else {
            current.push(ch);
        }
    }

    if !current.is_empty() {
        tokens.push(current);
    }

    if in_quotes {
        return Err("Unclosed quote in cURL command".to_string());
    }

    Ok(tokens)
}

/// Parse a header string like "Content-Type: application/json"
fn parse_header(header: &str) -> Option<(String, String)> {
    let parts: Vec<_> = header.splitn(2, ':').collect();
    if parts.len() == 2 {
        Some((parts[0].trim().to_string(), parts[1].trim().to_string()))
    } else {
        None
    }
}

/// Convert a parsed cURL command to HTTP file format
pub fn curl_to_http(cmd: &CurlCommand) -> String {
    let mut output = String::new();

    // Method and URL
    output.push_str(&format!("{} {}\n", cmd.method, cmd.url));

    // Auth header if present
    if let Some((user, pass)) = &cmd.auth {
        let credentials = format!("{}:{}", user, pass);
        let encoded = STANDARD.encode(credentials.as_bytes());
        output.push_str(&format!("Authorization: Basic {}\n", encoded));
    }

    // Headers (sorted for consistency)
    let mut headers: Vec<_> = cmd.headers.iter().collect();
    headers.sort_by_key(|(k, _)| k.to_lowercase());
    for (key, value) in headers {
        output.push_str(&format!("{}: {}\n", key, value));
    }

    // Body
    if let Some(body) = &cmd.body {
        output.push('\n');
        // Try to format JSON body
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(body) {
            if let Ok(formatted) = serde_json::to_string_pretty(&json) {
                output.push_str(&formatted);
            } else {
                output.push_str(body);
            }
        } else {
            output.push_str(body);
        }
        output.push('\n');
    }

    // Add comments for flags
    if !cmd.flags.is_empty() {
        if cmd.body.is_none() {
            output.push('\n');
        }
        output.push('\n');
        for flag in &cmd.flags {
            output.push_str(&format!("# Note: {} flag was set in cURL\n", flag));
        }
    }

    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_get() {
        let curl = "curl https://api.example.com/users";
        let cmd = parse_curl(curl).unwrap();
        assert_eq!(cmd.method, "GET");
        assert_eq!(cmd.url, "https://api.example.com/users");
    }

    #[test]
    fn test_post_with_data() {
        let curl = r#"curl -X POST https://api.example.com/users -d '{"name":"test"}'"#;
        let cmd = parse_curl(curl).unwrap();
        assert_eq!(cmd.method, "POST");
        assert_eq!(cmd.body, Some(r#"{"name":"test"}"#.to_string()));
    }

    #[test]
    fn test_headers() {
        let curl = r#"curl -H "Content-Type: application/json" -H "Accept: application/json" https://api.example.com"#;
        let cmd = parse_curl(curl).unwrap();
        assert_eq!(
            cmd.headers.get("Content-Type"),
            Some(&"application/json".to_string())
        );
        assert_eq!(
            cmd.headers.get("Accept"),
            Some(&"application/json".to_string())
        );
    }

    #[test]
    fn test_basic_auth() {
        let curl = "curl -u user:password https://api.example.com";
        let cmd = parse_curl(curl).unwrap();
        assert_eq!(cmd.auth, Some(("user".to_string(), "password".to_string())));
    }

    #[test]
    fn test_multiline() {
        let curl = r#"curl \
          -X POST \
          -H "Content-Type: application/json" \
          https://api.example.com/users"#;
        let cmd = parse_curl(curl).unwrap();
        assert_eq!(cmd.method, "POST");
        assert_eq!(cmd.url, "https://api.example.com/users");
    }

    #[test]
    fn test_convert_to_http() {
        let cmd = CurlCommand {
            method: "POST".to_string(),
            url: "https://api.example.com/users".to_string(),
            headers: [("Content-Type".to_string(), "application/json".to_string())]
                .into_iter()
                .collect(),
            body: Some(r#"{"name":"test"}"#.to_string()),
            auth: None,
            flags: vec![],
        };

        let http = curl_to_http(&cmd);
        assert!(http.contains("POST https://api.example.com/users"));
        assert!(http.contains("Content-Type: application/json"));
        assert!(http.contains(r#""name": "test""#)); // Formatted JSON
    }
}
