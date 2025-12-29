use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::Path;
use std::sync::mpsc::channel;
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

/// Global watcher state
static WATCHER: Mutex<Option<WatcherState>> = Mutex::new(None);

struct WatcherState {
    _watcher: RecommendedWatcher,
    watched_path: String,
}

/// Start watching a directory for file changes
#[tauri::command]
pub fn start_watching(app: AppHandle, directory: String) -> Result<(), String> {
    stop_watching()?;

    let (tx, rx) = channel();

    let mut watcher = RecommendedWatcher::new(
        move |res: Result<Event, notify::Error>| {
            if let Ok(event) = res {
                let _ = tx.send(event);
            }
        },
        Config::default().with_poll_interval(Duration::from_secs(2)),
    )
    .map_err(|e| format!("Failed to create watcher: {}", e))?;

    watcher
        .watch(Path::new(&directory), RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to watch directory: {}", e))?;

    let app_handle = app.clone();
    let watched_dir = directory.clone();

    // Spawn thread to handle file events
    thread::spawn(move || {
        // Debounce: collect events for a short period before emitting
        let mut last_emit = std::time::Instant::now();
        let debounce_duration = Duration::from_millis(500);

        loop {
            match rx.recv_timeout(Duration::from_secs(1)) {
                Ok(event) => {
                    // Check if any relevant files changed
                    let dominated_paths: Vec<String> = event
                        .paths
                        .iter()
                        .filter(|p| is_relevant_path(p))
                        .map(|p| p.to_string_lossy().to_string())
                        .collect();

                    if !dominated_paths.is_empty() && last_emit.elapsed() >= debounce_duration {
                        let _ = app_handle.emit("file-changed", &watched_dir);
                        last_emit = std::time::Instant::now();
                    }
                }
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                    // Check if we should stop
                    let guard = WATCHER.lock().unwrap();
                    if guard.is_none() {
                        break;
                    }
                }
                Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                    break;
                }
            }
        }
    });

    let mut guard = WATCHER.lock().unwrap();
    *guard = Some(WatcherState {
        _watcher: watcher,
        watched_path: directory,
    });

    Ok(())
}

/// Stop watching the current directory
#[tauri::command]
pub fn stop_watching() -> Result<(), String> {
    let mut guard = WATCHER.lock().unwrap();
    *guard = None;
    Ok(())
}

/// Get the currently watched path
#[tauri::command]
pub fn get_watched_path() -> Option<String> {
    let guard = WATCHER.lock().unwrap();
    guard.as_ref().map(|s| s.watched_path.clone())
}

/// Check if a path is relevant for our file tree
fn is_relevant_path(path: &Path) -> bool {
    let path_str = path.to_string_lossy().to_lowercase();

    // Skip hidden files and common non-relevant directories
    if path_str.contains("/.")
        || path_str.contains("/node_modules/")
        || path_str.contains("/target/")
    {
        return false;
    }

    // Check if it's a relevant file type or a directory
    if path.is_dir() {
        return true;
    }

    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    name.ends_with(".http") || name.ends_with(".rest") || name.contains(".env.json")
}
