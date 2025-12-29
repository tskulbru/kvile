use super::types::{ParseError, ParsedRequest};
use regex::Regex;
use std::collections::HashMap;

/// Parse HTTP content following the VS Code REST Client format
pub fn parse_vscode(content: &str) -> Result<Vec<ParsedRequest>, ParseError> {
    let mut requests = Vec::new();
    let mut current_request: Option<ParsedRequest> = None;
    let mut in_body = false;
    let mut body_lines: Vec<String> = Vec::new();
    let mut file_variables: HashMap<String, String> = HashMap::new();
    let mut current_line_number = 0;

    // Regex patterns
    let separator_re = Regex::new(r"^###\s*(.*)$").unwrap();
    let method_re = Regex::new(
        r"^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|TRACE|CONNECT)\s+(.+?)(?:\s+(HTTP/[\d.]+))?$",
    )
    .unwrap();
    let header_re = Regex::new(r"^([\w-]+):\s*(.*)$").unwrap();
    let comment_re = Regex::new(r"^(?:#|//)").unwrap();
    let variable_def_re = Regex::new(r"^@([\w-]+)\s*=\s*(.*)$").unwrap();

    for (idx, line) in content.lines().enumerate() {
        current_line_number = idx + 1;
        let trimmed = line.trim();

        // Check for variable definition (VS Code style: @name = value)
        if let Some(caps) = variable_def_re.captures(trimmed) {
            let name = caps.get(1).unwrap().as_str().to_string();
            let value = caps.get(2).unwrap().as_str().to_string();
            file_variables.insert(name, value);
            continue;
        }

        // Check for request separator
        if let Some(caps) = separator_re.captures(trimmed) {
            // Save previous request if exists
            if let Some(mut req) = current_request.take() {
                if in_body && !body_lines.is_empty() {
                    req.body = Some(body_lines.join("\n").trim().to_string());
                }
                if !req.url.is_empty() {
                    // Add file-level variables to request
                    req.variables = file_variables.clone();
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
            continue;
        }

        // Skip empty lines at the start
        if current_request.is_none() && trimmed.is_empty() {
            continue;
        }

        // Skip comments (but not after we've started parsing a request without separator)
        if current_request.is_none() && comment_re.is_match(trimmed) {
            continue;
        }

        // Initialize request if not started yet
        if current_request.is_none() {
            current_request = Some(ParsedRequest::new());
            current_request.as_mut().unwrap().line_number = current_line_number;
        }

        let request = current_request.as_mut().unwrap();

        // Handle body content
        if in_body {
            body_lines.push(line.to_string());
            continue;
        }

        // Skip comments within request definition
        if comment_re.is_match(trimmed) {
            continue;
        }

        // Check for HTTP method line
        if let Some(caps) = method_re.captures(trimmed) {
            request.method = caps.get(1).unwrap().as_str().to_string();
            request.url = caps.get(2).unwrap().as_str().to_string();
            if let Some(version) = caps.get(3) {
                request.http_version = Some(version.as_str().to_string());
            }
            continue;
        }

        // Check for header
        if let Some(caps) = header_re.captures(trimmed) {
            let key = caps.get(1).unwrap().as_str().to_string();
            let value = caps.get(2).unwrap().as_str().to_string();
            request.headers.insert(key, value);
            continue;
        }

        // Empty line starts body section
        if trimmed.is_empty() && !request.url.is_empty() {
            in_body = true;
            continue;
        }

        // If we have a URL-like line without method, assume GET
        if request.url.is_empty()
            && (trimmed.starts_with("http://")
                || trimmed.starts_with("https://")
                || trimmed.starts_with('/'))
        {
            request.url = trimmed.to_string();
            continue;
        }
    }

    // Don't forget the last request
    if let Some(mut req) = current_request {
        if in_body && !body_lines.is_empty() {
            req.body = Some(body_lines.join("\n").trim().to_string());
        }
        if !req.url.is_empty() {
            req.variables = file_variables;
            requests.push(req);
        }
    }

    Ok(requests)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_with_variables() {
        let content = r#"
@hostname = localhost
@port = 3000

GET http://{{hostname}}:{{port}}/users
"#;
        let requests = parse_vscode(content).unwrap();
        assert_eq!(requests.len(), 1);
        assert_eq!(
            requests[0].variables.get("hostname"),
            Some(&"localhost".to_string())
        );
        assert_eq!(requests[0].variables.get("port"), Some(&"3000".to_string()));
    }
}
