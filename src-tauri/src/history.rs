use chrono::{DateTime, Utc};
use rusqlite::{Connection, Result as SqliteResult};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

/// A single request/response history entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub id: i64,
    pub timestamp: DateTime<Utc>,
    pub workspace: String,
    pub file_path: Option<String>,
    pub request_name: Option<String>,
    pub method: String,
    pub url: String,
    pub request_headers: String, // JSON string
    pub request_body: Option<String>,
    pub status: i32,
    pub status_text: String,
    pub response_headers: String, // JSON string
    pub response_body: String,
    pub duration_ms: i64,
    pub response_size: i64,
}

/// Input for creating a new history entry (without id)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewHistoryEntry {
    pub workspace: String,
    pub file_path: Option<String>,
    pub request_name: Option<String>,
    pub method: String,
    pub url: String,
    pub request_headers: String,
    pub request_body: Option<String>,
    pub status: i32,
    pub status_text: String,
    pub response_headers: String,
    pub response_body: String,
    pub duration_ms: i64,
    pub response_size: i64,
}

/// Thread-safe wrapper for database connection
pub struct HistoryDb {
    conn: Mutex<Connection>,
}

impl HistoryDb {
    /// Create a new HistoryDb, initializing the database if needed
    pub fn new() -> SqliteResult<Self> {
        let db_path = get_database_path();

        // Ensure parent directory exists
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).ok();
        }

        let conn = Connection::open(&db_path)?;
        init_database(&conn)?;

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    /// Add a new entry to history
    pub fn add_entry(&self, entry: NewHistoryEntry) -> SqliteResult<i64> {
        let conn = self.conn.lock().unwrap();
        let now = Utc::now();

        conn.execute(
            "INSERT INTO history (
                timestamp, workspace, file_path, request_name,
                method, url, request_headers, request_body,
                status, status_text, response_headers, response_body,
                duration_ms, response_size
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
            rusqlite::params![
                now.to_rfc3339(),
                entry.workspace,
                entry.file_path,
                entry.request_name,
                entry.method,
                entry.url,
                entry.request_headers,
                entry.request_body,
                entry.status,
                entry.status_text,
                entry.response_headers,
                entry.response_body,
                entry.duration_ms,
                entry.response_size,
            ],
        )?;

        Ok(conn.last_insert_rowid())
    }

    /// Get history entries for a workspace (most recent first)
    pub fn get_entries(&self, workspace: &str, limit: i32) -> SqliteResult<Vec<HistoryEntry>> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn.prepare(
            "SELECT id, timestamp, workspace, file_path, request_name,
                    method, url, request_headers, request_body,
                    status, status_text, response_headers, response_body,
                    duration_ms, response_size
             FROM history
             WHERE workspace = ?1
             ORDER BY timestamp DESC
             LIMIT ?2",
        )?;

        let entries = stmt.query_map(rusqlite::params![workspace, limit], |row| {
            let timestamp_str: String = row.get(1)?;
            let timestamp = DateTime::parse_from_rfc3339(&timestamp_str)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now());

            Ok(HistoryEntry {
                id: row.get(0)?,
                timestamp,
                workspace: row.get(2)?,
                file_path: row.get(3)?,
                request_name: row.get(4)?,
                method: row.get(5)?,
                url: row.get(6)?,
                request_headers: row.get(7)?,
                request_body: row.get(8)?,
                status: row.get(9)?,
                status_text: row.get(10)?,
                response_headers: row.get(11)?,
                response_body: row.get(12)?,
                duration_ms: row.get(13)?,
                response_size: row.get(14)?,
            })
        })?;

        entries.collect()
    }

    /// Get a single history entry by ID
    pub fn get_entry(&self, id: i64) -> SqliteResult<Option<HistoryEntry>> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn.prepare(
            "SELECT id, timestamp, workspace, file_path, request_name,
                    method, url, request_headers, request_body,
                    status, status_text, response_headers, response_body,
                    duration_ms, response_size
             FROM history WHERE id = ?1",
        )?;

        let result = stmt.query_row(rusqlite::params![id], |row| {
            let timestamp_str: String = row.get(1)?;
            let timestamp = DateTime::parse_from_rfc3339(&timestamp_str)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now());

            Ok(HistoryEntry {
                id: row.get(0)?,
                timestamp,
                workspace: row.get(2)?,
                file_path: row.get(3)?,
                request_name: row.get(4)?,
                method: row.get(5)?,
                url: row.get(6)?,
                request_headers: row.get(7)?,
                request_body: row.get(8)?,
                status: row.get(9)?,
                status_text: row.get(10)?,
                response_headers: row.get(11)?,
                response_body: row.get(12)?,
                duration_ms: row.get(13)?,
                response_size: row.get(14)?,
            })
        });

        match result {
            Ok(entry) => Ok(Some(entry)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    /// Delete a specific history entry
    pub fn delete_entry(&self, id: i64) -> SqliteResult<bool> {
        let conn = self.conn.lock().unwrap();
        let affected = conn.execute("DELETE FROM history WHERE id = ?1", rusqlite::params![id])?;
        Ok(affected > 0)
    }

    /// Clear all history for a workspace
    pub fn clear_workspace(&self, workspace: &str) -> SqliteResult<usize> {
        let conn = self.conn.lock().unwrap();
        let affected = conn.execute(
            "DELETE FROM history WHERE workspace = ?1",
            rusqlite::params![workspace],
        )?;
        Ok(affected)
    }

    /// Clear all history
    #[allow(dead_code)]
    pub fn clear_all(&self) -> SqliteResult<usize> {
        let conn = self.conn.lock().unwrap();
        let affected = conn.execute("DELETE FROM history", [])?;
        Ok(affected)
    }

    /// Prune old entries, keeping only the most recent N entries per workspace
    #[allow(dead_code)]
    pub fn prune(&self, max_entries_per_workspace: i32) -> SqliteResult<usize> {
        let conn = self.conn.lock().unwrap();

        // Get all unique workspaces
        let mut stmt = conn.prepare("SELECT DISTINCT workspace FROM history")?;
        let workspaces: Vec<String> = stmt
            .query_map([], |row| row.get(0))?
            .filter_map(|r| r.ok())
            .collect();

        let mut total_deleted = 0;

        for workspace in workspaces {
            // Delete entries beyond the limit for each workspace
            let deleted = conn.execute(
                "DELETE FROM history WHERE workspace = ?1 AND id NOT IN (
                    SELECT id FROM history WHERE workspace = ?1
                    ORDER BY timestamp DESC LIMIT ?2
                )",
                rusqlite::params![workspace, max_entries_per_workspace],
            )?;
            total_deleted += deleted;
        }

        Ok(total_deleted)
    }
}

/// Get the database file path
fn get_database_path() -> PathBuf {
    let data_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("kvile");

    data_dir.join("history.db")
}

/// Initialize the database schema
fn init_database(conn: &Connection) -> SqliteResult<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            workspace TEXT NOT NULL,
            file_path TEXT,
            request_name TEXT,
            method TEXT NOT NULL,
            url TEXT NOT NULL,
            request_headers TEXT NOT NULL,
            request_body TEXT,
            status INTEGER NOT NULL,
            status_text TEXT NOT NULL,
            response_headers TEXT NOT NULL,
            response_body TEXT NOT NULL,
            duration_ms INTEGER NOT NULL,
            response_size INTEGER NOT NULL
        )",
        [],
    )?;

    // Create indexes for faster queries
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_history_workspace_timestamp
         ON history(workspace, timestamp DESC)",
        [],
    )?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_database_path() {
        let path = get_database_path();
        assert!(path.to_string_lossy().contains("kvile"));
        assert!(path.to_string_lossy().ends_with("history.db"));
    }
}
