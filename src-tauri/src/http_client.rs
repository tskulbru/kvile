use reqwest::{header::HeaderMap, Client, Method};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Instant;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HttpRequest {
    pub method: String,
    pub url: String,
    pub headers: HashMap<String, String>,
    pub body: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HttpResponse {
    pub status: u16,
    pub status_text: String,
    pub headers: HashMap<String, String>,
    pub body: String,
    pub time: u64,
    pub size: usize,
}

#[derive(Debug, thiserror::Error)]
pub enum HttpError {
    #[error("Invalid HTTP method: {0}")]
    InvalidMethod(String),
    #[error("Request failed: {0}")]
    RequestFailed(#[from] reqwest::Error),
    #[error("Invalid URL: {0}")]
    InvalidUrl(String),
}

pub async fn execute_request(request: HttpRequest) -> Result<HttpResponse, HttpError> {
    let client = Client::builder()
        .danger_accept_invalid_certs(false)
        .build()?;

    let method = match request.method.to_uppercase().as_str() {
        "GET" => Method::GET,
        "POST" => Method::POST,
        "PUT" => Method::PUT,
        "DELETE" => Method::DELETE,
        "PATCH" => Method::PATCH,
        "HEAD" => Method::HEAD,
        "OPTIONS" => Method::OPTIONS,
        "TRACE" => Method::TRACE,
        "CONNECT" => Method::CONNECT,
        other => return Err(HttpError::InvalidMethod(other.to_string())),
    };

    let mut headers = HeaderMap::new();
    for (key, value) in &request.headers {
        if let (Ok(name), Ok(val)) = (
            key.parse::<reqwest::header::HeaderName>(),
            value.parse::<reqwest::header::HeaderValue>(),
        ) {
            headers.insert(name, val);
        }
    }

    let start = Instant::now();

    let mut req_builder = client.request(method, &request.url).headers(headers);

    if let Some(body) = request.body {
        req_builder = req_builder.body(body);
    }

    let response = req_builder.send().await?;
    let elapsed = start.elapsed().as_millis() as u64;

    let status = response.status().as_u16();
    let status_text = response
        .status()
        .canonical_reason()
        .unwrap_or("Unknown")
        .to_string();

    let response_headers: HashMap<String, String> = response
        .headers()
        .iter()
        .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
        .collect();

    let body = response.text().await?;
    let size = body.len();

    Ok(HttpResponse {
        status,
        status_text,
        headers: response_headers,
        body,
        time: elapsed,
        size,
    })
}
