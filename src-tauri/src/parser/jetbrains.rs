use super::types::{ParseError, ParsedRequest};
use regex::Regex;

/// Extract a script block from content starting at the given line
/// Returns (script_content, end_line_index) if found
fn extract_script_block(lines: &[&str], start_idx: usize) -> Option<(String, usize)> {
    let mut script_lines = Vec::new();
    let mut found_end = false;
    let mut end_idx = start_idx;

    // Skip the opening line (< {% or > {%)
    for (i, line) in lines.iter().enumerate().skip(start_idx + 1) {
        let trimmed = line.trim();
        // Check for closing %} - can be standalone or at end of line
        if trimmed == "%}" || trimmed.ends_with("%}") {
            found_end = true;
            end_idx = i;
            // If there's content before %} on the same line, include it
            if trimmed != "%}" {
                let content = trimmed.trim_end_matches("%}").trim();
                if !content.is_empty() {
                    script_lines.push(content.to_string());
                }
            }
            break;
        }
        // Stop if we hit a request separator - script block is unclosed
        if trimmed.starts_with("###") {
            break;
        }
        script_lines.push(line.to_string());
    }

    if found_end {
        Some((script_lines.join("\n"), end_idx))
    } else {
        None
    }
}

/// Parse HTTP content following the JetBrains HTTP Client specification
pub fn parse_jetbrains(content: &str) -> Result<Vec<ParsedRequest>, ParseError> {
    let mut requests = Vec::new();
    let mut current_request: Option<ParsedRequest> = None;
    let mut in_body = false;
    let mut body_lines: Vec<String> = Vec::new();
    let lines: Vec<&str> = content.lines().collect();
    // File-level variables (VS Code style @var = value)
    let mut file_variables: std::collections::HashMap<String, String> = std::collections::HashMap::new();

    // Regex patterns
    let separator_re = Regex::new(r"^###\s*(.*)$").unwrap();
    let method_re = Regex::new(r"^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|TRACE|CONNECT)\s+(.+?)(?:\s+(HTTP/[\d.]+))?$").unwrap();
    let header_re = Regex::new(r"^([\w-]+):\s*(.*)$").unwrap();
    let comment_re = Regex::new(r"^(?:#|//)").unwrap();
    let metadata_re = Regex::new(r"^#\s*@([\w-]+)\s+(.*)$").unwrap();
    let pre_script_re = Regex::new(r"^<\s*\{%").unwrap();
    let post_script_re = Regex::new(r"^>\s*\{%").unwrap();
    // VS Code style variable definition: @name = value
    let vscode_var_re = Regex::new(r"^@([\w-]+)\s*=\s*(.*)$").unwrap();

    let mut idx = 0;
    while idx < lines.len() {
        let line = lines[idx];
        let current_line_number = idx + 1;
        let trimmed = line.trim();

        // Check for pre-request script (< {%)
        if pre_script_re.is_match(trimmed) {
            if let Some((script, end_idx)) = extract_script_block(&lines, idx) {
                // Ensure we have a request to attach the script to
                if current_request.is_none() {
                    current_request = Some(ParsedRequest::new());
                    current_request.as_mut().unwrap().line_number = current_line_number;
                }
                current_request.as_mut().unwrap().pre_script = Some(script);
                idx = end_idx + 1;
                continue;
            }
        }

        // Check for post-request script (> {%)
        if post_script_re.is_match(trimmed) {
            if let Some((script, end_idx)) = extract_script_block(&lines, idx) {
                if let Some(ref mut req) = current_request {
                    req.post_script = Some(script);
                }
                // Post-request script marks the end of body content
                in_body = false;
                idx = end_idx + 1;
                continue;
            }
        }

        // Check for request separator
        if let Some(caps) = separator_re.captures(trimmed) {
            // Save previous request if exists
            if let Some(mut req) = current_request.take() {
                if in_body && !body_lines.is_empty() {
                    req.body = Some(body_lines.join("\n").trim().to_string());
                }
                // Copy file-level variables to request
                for (k, v) in &file_variables {
                    req.variables.insert(k.clone(), v.clone());
                }
                if !req.url.is_empty() {
                    requests.push(req);
                }
            }

            // Start new request
            let name = caps.get(1).map(|m| m.as_str().trim().to_string());
            let mut new_request = ParsedRequest::new();
            new_request.line_number = current_line_number;
            if let Some(n) = name {
                if !n.is_empty() {
                    new_request.name = Some(n);
                }
            }
            current_request = Some(new_request);
            in_body = false;
            body_lines.clear();
            idx += 1;
            continue;
        }

        // Skip empty lines at the start
        if current_request.is_none() && trimmed.is_empty() {
            idx += 1;
            continue;
        }

        // Initialize request if not started yet
        if current_request.is_none() {
            current_request = Some(ParsedRequest::new());
            current_request.as_mut().unwrap().line_number = current_line_number;
        }

        let request = current_request.as_mut().unwrap();

        // Handle body content (but not post-request scripts)
        if in_body {
            // Check if this is a post-request script starting
            if post_script_re.is_match(trimmed) {
                if let Some((script, end_idx)) = extract_script_block(&lines, idx) {
                    request.post_script = Some(script);
                    // Post-request script marks the end of body content
                    in_body = false;
                    idx = end_idx + 1;
                    continue;
                }
            }
            body_lines.push(line.to_string());
            idx += 1;
            continue;
        }

        // Check for metadata annotations (# @key value)
        if let Some(caps) = metadata_re.captures(trimmed) {
            let key = caps.get(1).unwrap().as_str().to_string();
            let value = caps.get(2).unwrap().as_str().to_string();
            request.metadata.insert(key, value);
            idx += 1;
            continue;
        }

        // Skip comments
        if comment_re.is_match(trimmed) {
            idx += 1;
            continue;
        }

        // Check for VS Code style variable definition (@name = value)
        if let Some(caps) = vscode_var_re.captures(trimmed) {
            let name = caps.get(1).unwrap().as_str().to_string();
            let value = caps.get(2).unwrap().as_str().to_string();
            file_variables.insert(name, value);
            idx += 1;
            continue;
        }

        // Check for HTTP method line
        if let Some(caps) = method_re.captures(trimmed) {
            request.method = caps.get(1).unwrap().as_str().to_string();
            request.url = caps.get(2).unwrap().as_str().to_string();
            if let Some(version) = caps.get(3) {
                request.http_version = Some(version.as_str().to_string());
            }
            idx += 1;
            continue;
        }

        // Check for header
        if let Some(caps) = header_re.captures(trimmed) {
            let key = caps.get(1).unwrap().as_str().to_string();
            let value = caps.get(2).unwrap().as_str().to_string();
            request.headers.insert(key, value);
            idx += 1;
            continue;
        }

        // Empty line starts body section
        if trimmed.is_empty() && !request.url.is_empty() {
            in_body = true;
            idx += 1;
            continue;
        }

        // If we have a URL-like line without method, assume GET
        if request.url.is_empty() && (trimmed.starts_with("http://") || trimmed.starts_with("https://") || trimmed.starts_with('/')) {
            request.url = trimmed.to_string();
            idx += 1;
            continue;
        }

        idx += 1;
    }

    // Don't forget the last request
    if let Some(mut req) = current_request {
        if in_body && !body_lines.is_empty() {
            req.body = Some(body_lines.join("\n").trim().to_string());
        }
        // Copy file-level variables to request
        for (k, v) in &file_variables {
            req.variables.insert(k.clone(), v.clone());
        }
        if !req.url.is_empty() {
            requests.push(req);
        }
    }

    Ok(requests)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_simple_get() {
        let content = r#"
GET https://api.example.com/users
"#;
        let requests = parse_jetbrains(content).unwrap();
        assert_eq!(requests.len(), 1);
        assert_eq!(requests[0].method, "GET");
        assert_eq!(requests[0].url, "https://api.example.com/users");
    }

    #[test]
    fn test_parse_with_headers() {
        let content = r#"
GET https://api.example.com/users
Content-Type: application/json
Authorization: Bearer token123
"#;
        let requests = parse_jetbrains(content).unwrap();
        assert_eq!(requests.len(), 1);
        assert_eq!(requests[0].headers.get("Content-Type"), Some(&"application/json".to_string()));
        assert_eq!(requests[0].headers.get("Authorization"), Some(&"Bearer token123".to_string()));
    }

    #[test]
    fn test_parse_with_body() {
        let content = r#"
POST https://api.example.com/users
Content-Type: application/json

{
  "name": "John",
  "email": "john@example.com"
}
"#;
        let requests = parse_jetbrains(content).unwrap();
        assert_eq!(requests.len(), 1);
        assert_eq!(requests[0].method, "POST");
        assert!(requests[0].body.is_some());
    }

    #[test]
    fn test_parse_multiple_requests() {
        let content = r#"
### Get all users
GET https://api.example.com/users

###
POST https://api.example.com/users
Content-Type: application/json

{"name": "John"}
"#;
        let requests = parse_jetbrains(content).unwrap();
        assert_eq!(requests.len(), 2);
        assert_eq!(requests[0].name, Some("Get all users".to_string()));
        assert_eq!(requests[0].method, "GET");
        assert_eq!(requests[1].method, "POST");
    }

    #[test]
    fn test_parse_pre_request_script() {
        let content = r#"
< {%
    request.variables.set("timestamp", Date.now());
%}

GET https://api.example.com/users
X-Timestamp: {{timestamp}}
"#;
        let requests = parse_jetbrains(content).unwrap();
        assert_eq!(requests.len(), 1);
        assert!(requests[0].pre_script.is_some());
        let script = requests[0].pre_script.as_ref().unwrap();
        assert!(script.contains("request.variables.set"));
    }

    #[test]
    fn test_parse_post_request_script() {
        let content = r#"
GET https://api.example.com/users

> {%
    client.global.set("userCount", response.body.length);
    client.test("Status is 200", function() {
        client.assert(response.status === 200);
    });
%}
"#;
        let requests = parse_jetbrains(content).unwrap();
        assert_eq!(requests.len(), 1);
        assert!(requests[0].post_script.is_some());
        let script = requests[0].post_script.as_ref().unwrap();
        assert!(script.contains("client.global.set"));
        assert!(script.contains("client.test"));
    }

    #[test]
    fn test_parse_both_scripts() {
        let content = r#"
< {%
    request.variables.set("nonce", Math.random());
%}

POST https://api.example.com/auth
Content-Type: application/json

{"nonce": "{{nonce}}"}

> {%
    client.global.set("token", response.body.token);
%}
"#;
        let requests = parse_jetbrains(content).unwrap();
        assert_eq!(requests.len(), 1);
        assert!(requests[0].pre_script.is_some());
        assert!(requests[0].post_script.is_some());
        assert!(requests[0].pre_script.as_ref().unwrap().contains("nonce"));
        assert!(requests[0].post_script.as_ref().unwrap().contains("token"));
    }

    #[test]
    fn test_parse_multiline_post_script() {
        // This mimics the exact structure in demo.http
        let content = r#"### Get posts with tests
GET {{baseUrl}}/posts

> {%
    client.test("Status is 200", function() {
        client.assert(response.status === 200, "Expected 200 OK");
    });

    client.test("Response is array", function() {
        client.assert(Array.isArray(response.body), "Expected array response");
    });

    // Store first post ID for next request
    client.global.set("firstPostId", response.body[0].id);
    client.log("Found", response.body.length, "posts");
%}

###

### Next request
GET {{baseUrl}}/posts/1
"#;
        let requests = parse_jetbrains(content).unwrap();
        assert_eq!(requests.len(), 2);
        assert!(requests[0].post_script.is_some(), "First request should have post_script");
        assert!(requests[0].body.is_none(), "First request should not have body");
        let script = requests[0].post_script.as_ref().unwrap();
        assert!(script.contains("client.test"));
        assert!(script.contains("client.global.set"));
    }
}
