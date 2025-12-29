use super::types::{HttpFileFormat, ParseError, ParsedRequest};
use super::{jetbrains, vscode};
use regex::Regex;

/// Detect the format of an HTTP file based on its content
pub fn detect_format(content: &str) -> HttpFileFormat {
    // JetBrains script blocks: < {% or > {%
    // If scripts are present, use JetBrains parser as it supports scripts
    let has_scripts = content.lines().any(|line| {
        let trimmed = line.trim();
        trimmed.starts_with("< {%") || trimmed.starts_with("> {%")
    });

    if has_scripts {
        return HttpFileFormat::JetBrains;
    }

    // VS Code style variable definitions: @name = value
    let vscode_var_re = Regex::new(r"^@[\w-]+\s*=").unwrap();

    // JetBrains style uses {{variables}} but doesn't have @var = value definitions
    let has_vscode_vars = content.lines().any(|line| vscode_var_re.is_match(line.trim()));

    if has_vscode_vars {
        HttpFileFormat::VsCode
    } else {
        // Default to JetBrains format as it's the most comprehensive
        HttpFileFormat::JetBrains
    }
}

/// Parse HTTP file content, automatically detecting the format
pub fn parse_http_content(content: &str) -> Result<Vec<ParsedRequest>, ParseError> {
    let format = detect_format(content);

    match format {
        HttpFileFormat::VsCode => vscode::parse_vscode(content),
        HttpFileFormat::JetBrains | HttpFileFormat::Unknown => jetbrains::parse_jetbrains(content),
    }
}

/// Substitute variables in a string with their values
pub fn substitute_variables(
    input: &str,
    variables: &std::collections::HashMap<String, String>,
) -> String {
    let var_re = Regex::new(r"\{\{([\w.-]+)\}\}").unwrap();

    var_re.replace_all(input, |caps: &regex::Captures| {
        let var_name = &caps[1];
        variables.get(var_name).cloned().unwrap_or_else(|| format!("{{{{{}}}}}", var_name))
    }).to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_vscode_format() {
        let content = r#"
@hostname = localhost
@port = 3000

GET http://{{hostname}}:{{port}}/api
"#;
        assert_eq!(detect_format(content), HttpFileFormat::VsCode);
    }

    #[test]
    fn test_detect_jetbrains_format() {
        let content = r#"
### Get users
GET https://api.example.com/users
Content-Type: application/json
"#;
        assert_eq!(detect_format(content), HttpFileFormat::JetBrains);
    }

    #[test]
    fn test_substitute_variables() {
        let mut vars = std::collections::HashMap::new();
        vars.insert("host".to_string(), "localhost".to_string());
        vars.insert("port".to_string(), "8080".to_string());

        let result = substitute_variables("http://{{host}}:{{port}}/api", &vars);
        assert_eq!(result, "http://localhost:8080/api");
    }

    #[test]
    fn test_substitute_missing_variable() {
        let vars = std::collections::HashMap::new();
        let result = substitute_variables("http://{{host}}/api", &vars);
        assert_eq!(result, "http://{{host}}/api");
    }
}
