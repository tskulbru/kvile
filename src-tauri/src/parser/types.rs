use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Represents a parsed HTTP request from an .http file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedRequest {
    /// Optional name of the request (from ### Name or # @name)
    pub name: Option<String>,
    /// HTTP method (GET, POST, etc.)
    pub method: String,
    /// Request URL (may contain variables like {{host}})
    pub url: String,
    /// HTTP version (optional, e.g., HTTP/1.1)
    pub http_version: Option<String>,
    /// Request headers
    pub headers: HashMap<String, String>,
    /// Request body (if present)
    pub body: Option<String>,
    /// Line number where this request starts
    pub line_number: usize,
    /// Variables defined in this request scope
    pub variables: HashMap<String, String>,
    /// Metadata/annotations (Kulala style: # @key value)
    pub metadata: HashMap<String, String>,
    /// Pre-request script content
    pub pre_script: Option<String>,
    /// Post-request script content
    pub post_script: Option<String>,
}

impl ParsedRequest {
    pub fn new() -> Self {
        Self {
            name: None,
            method: "GET".to_string(),
            url: String::new(),
            http_version: None,
            headers: HashMap::new(),
            body: None,
            line_number: 0,
            variables: HashMap::new(),
            metadata: HashMap::new(),
            pre_script: None,
            post_script: None,
        }
    }
}

impl Default for ParsedRequest {
    fn default() -> Self {
        Self::new()
    }
}

/// Detected format of the .http file
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HttpFileFormat {
    /// JetBrains HTTP Client format
    JetBrains,
    /// VS Code REST Client format
    VsCode,
    /// Mixed or unknown format
    #[allow(dead_code)]
    Unknown,
}

/// Error type for parsing operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParseError {
    pub message: String,
    pub line: Option<usize>,
}

impl std::fmt::Display for ParseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self.line {
            Some(line) => write!(f, "Parse error at line {}: {}", line, self.message),
            None => write!(f, "Parse error: {}", self.message),
        }
    }
}

impl std::error::Error for ParseError {}
