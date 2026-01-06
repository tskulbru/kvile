use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Environment {
    pub name: String,
    pub variables: HashMap<String, String>,
    /// Variables from the private env file (tracked separately for editing)
    #[serde(default)]
    pub private_variables: HashMap<String, String>,
    pub source_file: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentConfig {
    pub environments: Vec<Environment>,
    pub shared: HashMap<String, String>,
    /// Shared variables from the private env file
    #[serde(default)]
    pub private_shared: HashMap<String, String>,
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
                private_variables: HashMap::new(),
                source_file: path.to_string_lossy().to_string(),
            });
        }
    }

    // Sort environments alphabetically for consistent ordering
    environments.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(EnvironmentConfig {
        environments,
        shared,
        private_shared: HashMap::new(),
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

        // Also try to load private env file - keep separate for editing
        let private_env_path = workspace_path.join("http-client.private.env.json");
        if private_env_path.exists() {
            if let Ok(private_config) = parse_http_client_env(&private_env_path).await {
                // Store private variables separately for each environment
                for private_env in private_config.environments {
                    if let Some(env) = config
                        .environments
                        .iter_mut()
                        .find(|e| e.name == private_env.name)
                    {
                        // Store in private_variables, don't merge into variables
                        env.private_variables = private_env.variables;
                    } else {
                        // Environment only exists in private file
                        config.environments.push(Environment {
                            name: private_env.name,
                            variables: HashMap::new(),
                            private_variables: private_env.variables,
                            source_file: private_env_path.to_string_lossy().to_string(),
                        });
                    }
                }
                // Store private shared variables separately
                config.private_shared = private_config.shared;
            }
        }

        // Re-sort after potentially adding private-only environments
        config.environments.sort_by(|a, b| a.name.cmp(&b.name));

        return Ok(config);
    }

    // Try http-client.private.env.json alone
    let private_env_path = workspace_path.join("http-client.private.env.json");
    if private_env_path.exists() {
        let private_config = parse_http_client_env(&private_env_path).await?;
        // When only private file exists, put all vars in private_variables
        return Ok(EnvironmentConfig {
            environments: private_config
                .environments
                .into_iter()
                .map(|e| Environment {
                    name: e.name,
                    variables: HashMap::new(),
                    private_variables: e.variables,
                    source_file: e.source_file,
                })
                .collect(),
            shared: HashMap::new(),
            private_shared: private_config.shared,
        });
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
                private_variables: HashMap::new(),
                source_file: dotenv_path.to_string_lossy().to_string(),
            }],
            shared: HashMap::new(),
            private_shared: HashMap::new(),
        });
    }

    // No env files found - return empty config
    Ok(EnvironmentConfig {
        environments: vec![],
        shared: HashMap::new(),
        private_shared: HashMap::new(),
    })
}

/// Save or update an environment in the workspace
#[tauri::command]
pub async fn save_environment(
    workspace: String,
    env_name: String,
    variables: HashMap<String, String>,
    is_private: bool,
) -> Result<(), String> {
    let workspace_path = Path::new(&workspace);
    let file_name = if is_private {
        "http-client.private.env.json"
    } else {
        "http-client.env.json"
    };
    let file_path = workspace_path.join(file_name);

    // Read existing config or create new one
    let mut config: HashMap<String, HashMap<String, serde_json::Value>> = if file_path.exists() {
        let content = tokio::fs::read_to_string(&file_path)
            .await
            .map_err(|e| format!("Failed to read env file: {}", e))?;
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse env file: {}", e))?
    } else {
        HashMap::new()
    };

    // Convert variables to JSON values
    let json_variables: HashMap<String, serde_json::Value> = variables
        .into_iter()
        .map(|(k, v)| (k, serde_json::Value::String(v)))
        .collect();

    // Update or insert the environment
    config.insert(env_name, json_variables);

    // Write back to file with pretty formatting
    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize env file: {}", e))?;

    tokio::fs::write(&file_path, content)
        .await
        .map_err(|e| format!("Failed to write env file: {}", e))?;

    Ok(())
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
