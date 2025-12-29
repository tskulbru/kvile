use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Environment {
    pub name: String,
    pub variables: HashMap<String, String>,
    pub source_file: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentConfig {
    pub environments: Vec<Environment>,
    pub shared: HashMap<String, String>,
}

/// Parse http-client.env.json format (JetBrains style)
pub async fn parse_http_client_env(path: &Path) -> Result<EnvironmentConfig, String> {
    let content = tokio::fs::read_to_string(path)
        .await
        .map_err(|e| format!("Failed to read env file: {}", e))?;

    let parsed: HashMap<String, HashMap<String, serde_json::Value>> =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse env file: {}", e))?;

    let mut environments = Vec::new();
    let mut shared = HashMap::new();

    for (name, vars) in parsed {
        // Convert values to strings
        let string_vars: HashMap<String, String> = vars
            .into_iter()
            .map(|(k, v)| {
                let string_val = match v {
                    serde_json::Value::String(s) => s,
                    serde_json::Value::Number(n) => n.to_string(),
                    serde_json::Value::Bool(b) => b.to_string(),
                    _ => v.to_string(),
                };
                (k, string_val)
            })
            .collect();

        if name == "$shared" {
            shared = string_vars;
        } else {
            environments.push(Environment {
                name,
                variables: string_vars,
                source_file: path.to_string_lossy().to_string(),
            });
        }
    }

    // Sort environments alphabetically for consistent ordering
    environments.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(EnvironmentConfig {
        environments,
        shared,
    })
}

/// Parse .env file format
pub fn parse_dotenv(content: &str) -> HashMap<String, String> {
    let mut vars = HashMap::new();

    for line in content.lines() {
        let line = line.trim();

        // Skip comments and empty lines
        if line.is_empty() || line.starts_with('#') {
            continue;
        }

        if let Some(pos) = line.find('=') {
            let key = line[..pos].trim().to_string();
            let value = line[pos + 1..].trim().to_string();
            // Remove quotes if present
            let value = value
                .trim_start_matches('"')
                .trim_end_matches('"')
                .trim_start_matches('\'')
                .trim_end_matches('\'')
                .to_string();
            vars.insert(key, value);
        }
    }

    vars
}

/// Load environment configuration from workspace
#[tauri::command]
pub async fn load_environment_config(workspace: String) -> Result<EnvironmentConfig, String> {
    let workspace_path = Path::new(&workspace);

    // Try http-client.env.json first
    let env_json_path = workspace_path.join("http-client.env.json");
    if env_json_path.exists() {
        let mut config = parse_http_client_env(&env_json_path).await?;

        // Also try to load private env file and merge
        let private_env_path = workspace_path.join("http-client.private.env.json");
        if private_env_path.exists() {
            if let Ok(private_config) = parse_http_client_env(&private_env_path).await {
                // Merge private variables into existing environments
                for private_env in private_config.environments {
                    if let Some(env) = config
                        .environments
                        .iter_mut()
                        .find(|e| e.name == private_env.name)
                    {
                        // Private variables override public ones
                        env.variables.extend(private_env.variables);
                    } else {
                        config.environments.push(private_env);
                    }
                }
                // Merge shared variables
                config.shared.extend(private_config.shared);
            }
        }

        return Ok(config);
    }

    // Try http-client.private.env.json alone
    let private_env_path = workspace_path.join("http-client.private.env.json");
    if private_env_path.exists() {
        return parse_http_client_env(&private_env_path).await;
    }

    // Fallback to .env file
    let dotenv_path = workspace_path.join(".env");
    if dotenv_path.exists() {
        let content = tokio::fs::read_to_string(&dotenv_path)
            .await
            .map_err(|e| e.to_string())?;

        let vars = parse_dotenv(&content);

        return Ok(EnvironmentConfig {
            environments: vec![Environment {
                name: "default".to_string(),
                variables: vars,
                source_file: dotenv_path.to_string_lossy().to_string(),
            }],
            shared: HashMap::new(),
        });
    }

    // No env files found - return empty config
    Ok(EnvironmentConfig {
        environments: vec![],
        shared: HashMap::new(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_dotenv() {
        let content = r#"
# This is a comment
HOST=localhost:3000
API_TOKEN=your-token
DEBUG=true
QUOTED="hello world"
SINGLE_QUOTED='single quotes'
"#;

        let vars = parse_dotenv(content);
        assert_eq!(vars.get("HOST"), Some(&"localhost:3000".to_string()));
        assert_eq!(vars.get("API_TOKEN"), Some(&"your-token".to_string()));
        assert_eq!(vars.get("DEBUG"), Some(&"true".to_string()));
        assert_eq!(vars.get("QUOTED"), Some(&"hello world".to_string()));
        assert_eq!(
            vars.get("SINGLE_QUOTED"),
            Some(&"single quotes".to_string())
        );
    }
}
