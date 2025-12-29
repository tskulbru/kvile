mod commands;
mod curl;
mod env;
mod history;
mod http_client;
mod oidc;
mod parser;
mod watcher;

use commands::*;
use env::*;
use history::HistoryDb;
use watcher::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize history database
    let history_db = HistoryDb::new().expect("Failed to initialize history database");

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(history_db)
        .invoke_handler(tauri::generate_handler![
            send_request,
            parse_http_file,
            read_file,
            write_file,
            list_http_files,
            start_watching,
            stop_watching,
            get_watched_path,
            load_environment_config,
            // History commands
            get_history,
            get_history_entry,
            add_history_entry,
            delete_history_entry,
            clear_history,
            // Import commands
            convert_curl_to_http,
            // OIDC commands
            oidc_discover,
            oidc_start_auth,
            oidc_wait_for_callback,
            oidc_exchange_code,
            oidc_refresh_token,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
