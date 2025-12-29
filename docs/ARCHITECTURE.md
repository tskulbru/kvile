# Architecture Overview

This document describes the architecture of Kvile, an HTTP debugging application built with Tauri 2.

## Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Desktop Framework | Tauri 2 | Small bundles, native performance, Rust backend |
| Frontend | React 18 + TypeScript | UI components and state management |
| Code Editor | Monaco Editor | VS Code's editor with .http syntax support |
| UI Components | shadcn/ui | Tailwind + Radix primitives |
| State Management | Zustand | Lightweight stores with persistence |
| HTTP Client | reqwest | Rust async HTTP with full control |
| Styling | Tailwind CSS | Utility-first styling |
| Database | SQLite (rusqlite) | Request history storage |

## HTTP File Formats Supported

- **JetBrains HTTP Client** - `{{variables}}`, `###` separators, `> {% %}` handlers
- **VS Code REST Client** - `@var = value` definitions
- **Kulala extensions** - `# @directive` metadata
- Auto-detection based on syntax patterns

## Project Structure

```
kvile/
├── src/                              # React frontend
│   ├── components/
│   │   ├── CommandPalette/           # Keyboard-driven command palette
│   │   ├── Dialog/                   # Modal dialogs (unsaved changes, etc.)
│   │   ├── Editor/
│   │   │   ├── HttpEditor.tsx        # Monaco editor with .http syntax
│   │   │   ├── RequestEditor.tsx     # GUI form-based request editor
│   │   │   ├── HeadersEditor.tsx     # Key-value header editor
│   │   │   ├── BodyEditor.tsx        # Request body editor
│   │   │   └── ViewToggle.tsx        # GUI/Source view switcher
│   │   ├── Environment/
│   │   │   ├── EnvironmentPanel.tsx  # Environment variable viewer
│   │   │   └── ResponseVariablesPanel.tsx
│   │   ├── Help/
│   │   │   └── ShortcutsPanel.tsx    # Keyboard shortcuts reference
│   │   ├── History/
│   │   │   └── HistoryPanel.tsx      # Request history browser
│   │   ├── Import/
│   │   │   └── CurlImportDialog.tsx  # cURL to HTTP converter
│   │   ├── Layout/
│   │   │   ├── Sidebar.tsx           # File tree, request outline
│   │   │   ├── MainContent.tsx       # Editor + response panels
│   │   │   └── StatusBar.tsx         # Status, timing display
│   │   ├── RequestOutline/           # Request navigation within files
│   │   ├── Response/
│   │   │   ├── ResponsePanel.tsx     # Response body, headers, raw
│   │   │   ├── DiffPanel.tsx         # Response comparison
│   │   │   ├── RunAllResults.tsx     # Batch execution results
│   │   │   └── TestResultsPanel.tsx  # Script test results
│   │   └── Settings/
│   │       └── SettingsPanel.tsx     # Application settings
│   │
│   ├── hooks/
│   │   ├── useFileWatcher.ts         # File system change detection
│   │   ├── useGlobalShortcuts.ts     # Global keyboard shortcuts
│   │   ├── useKeyboardShortcuts.ts   # Component-level shortcuts
│   │   ├── useParseDebounced.ts      # Debounced HTTP file parsing
│   │   ├── useRegisterCommands.ts    # Command palette registration
│   │   └── useTauri.ts               # Tauri context detection
│   │
│   ├── lib/
│   │   ├── auth-helpers.ts           # OAuth/OIDC utilities
│   │   ├── commands.ts               # Command palette definitions
│   │   ├── dynamic-variables.ts      # $uuid, $timestamp, etc.
│   │   ├── http-parser.ts            # Frontend parsing wrapper
│   │   ├── http-serializer.ts        # Convert requests back to .http
│   │   ├── response-formatter.ts     # Format JSON, XML, HTML responses
│   │   ├── script-runtime.ts         # Pre/post-request script execution
│   │   ├── shortcuts.ts              # Keyboard shortcut definitions
│   │   ├── tauri.ts                  # Tauri IPC wrappers
│   │   ├── utils.ts                  # Tailwind utilities (cn)
│   │   └── variables.ts              # Variable substitution
│   │
│   ├── stores/
│   │   ├── appStore.ts               # Main application state
│   │   ├── authStore.ts              # OIDC/OAuth state
│   │   ├── scriptStore.ts            # Script execution state
│   │   └── settingsStore.ts          # Editor and UI settings
│   │
│   ├── App.tsx                       # Main app component
│   ├── main.tsx                      # React entry point
│   └── index.css                     # Tailwind + CSS variables
│
├── src-tauri/                        # Rust backend
│   ├── src/
│   │   ├── main.rs                   # Tauri entry point
│   │   ├── lib.rs                    # Plugin and command registration
│   │   ├── commands.rs               # Core Tauri IPC commands
│   │   ├── http_client.rs            # HTTP execution (reqwest)
│   │   ├── curl.rs                   # cURL command parsing
│   │   ├── env.rs                    # Environment file loading
│   │   ├── history.rs                # SQLite history database
│   │   ├── oidc.rs                   # OpenID Connect flow
│   │   ├── watcher.rs                # File system watcher
│   │   └── parser/
│   │       ├── mod.rs                # Parser module exports
│   │       ├── types.rs              # ParsedRequest, HttpFileFormat
│   │       ├── jetbrains.rs          # JetBrains spec parser
│   │       ├── vscode.rs             # VS Code format parser
│   │       └── detect.rs             # Auto-detection logic
│   │
│   ├── capabilities/
│   │   └── default.json              # Tauri 2 security permissions
│   ├── Cargo.toml                    # Rust dependencies
│   └── tauri.conf.json               # Tauri configuration
│
├── examples/                         # Example .http files
└── docs/                             # Documentation
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Frontend (React)                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────┐  ┌────────────────┐  ┌─────────────────────────────┐ │
│  │ Sidebar  │  │     Editor     │  │      Response Panel         │ │
│  │          │  │ (Monaco/GUI)   │  │                             │ │
│  │ - Files  │  │                │  │ - Body/Headers/Raw tabs     │ │
│  │ - Reqs   │  │ - .http syntax │  │ - Test results              │ │
│  │ - Envs   │  │ - Variables    │  │ - Diff comparison           │ │
│  └────┬─────┘  └───────┬────────┘  └─────────────┬───────────────┘ │
│       │                │                          │                 │
│       └────────────────┼──────────────────────────┘                 │
│                        │                                            │
│           ┌────────────┴────────────┐                               │
│           │    Zustand Stores       │                               │
│           │  appStore, authStore,   │                               │
│           │  scriptStore, settings  │                               │
│           └────────────┬────────────┘                               │
└────────────────────────┼────────────────────────────────────────────┘
                         │ Tauri IPC (invoke)
┌────────────────────────┼────────────────────────────────────────────┐
│                        │         Backend (Rust)                     │
├────────────────────────┼────────────────────────────────────────────┤
│                ┌───────┴───────┐                                    │
│                │   Commands    │                                    │
│                └───────┬───────┘                                    │
│    ┌───────────┬───────┼───────┬───────────┬───────────┐           │
│    │           │       │       │           │           │           │
│ ┌──┴───┐  ┌────┴────┐ ┌┴─────┐ ┌┴────────┐ ┌┴───────┐ ┌┴────────┐ │
│ │Parser│  │HTTP     │ │  FS  │ │ History │ │ OIDC   │ │ Watcher │ │
│ │      │  │Client   │ │      │ │ (SQLite)│ │        │ │         │ │
│ └──────┘  └─────────┘ └──────┘ └─────────┘ └────────┘ └─────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## Tauri Commands (IPC API)

### Core Commands (`commands.rs`)

| Command | Description |
|---------|-------------|
| `send_request` | Execute an HTTP request via reqwest |
| `parse_http_file` | Parse .http file content into requests |
| `read_file` | Read file from disk |
| `write_file` | Write file to disk |
| `list_http_files` | List .http files in a directory (recursive) |

### File Watching (`watcher.rs`)

| Command | Description |
|---------|-------------|
| `start_watching` | Begin watching a directory for changes |
| `stop_watching` | Stop file system watching |
| `get_watched_path` | Get currently watched directory |

### Environment (`env.rs`)

| Command | Description |
|---------|-------------|
| `load_environment_config` | Load environment files from workspace |

### History (`history.rs`)

| Command | Description |
|---------|-------------|
| `get_history` | Retrieve paginated history entries |
| `get_history_entry` | Get single history entry by ID |
| `add_history_entry` | Store a request/response in history |
| `delete_history_entry` | Remove a history entry |
| `clear_history` | Clear all history entries |

### Import (`curl.rs`)

| Command | Description |
|---------|-------------|
| `convert_curl_to_http` | Convert cURL command to .http format |

### OIDC/OAuth (`oidc.rs`)

| Command | Description |
|---------|-------------|
| `oidc_discover` | Fetch OpenID Connect discovery document |
| `oidc_start_auth` | Begin authorization flow, start local server |
| `oidc_wait_for_callback` | Wait for OAuth callback |
| `oidc_exchange_code` | Exchange auth code for tokens |
| `oidc_refresh_token` | Refresh an access token |

## State Management

### appStore (Main State)

Manages core application state:
- **Theme**: Dark/light mode (persisted)
- **Files**: Open files, active file, modified state
- **Requests**: Current request/response, parsed requests
- **UI State**: Loading, sidebar visibility, panels
- **Workspace**: Current directory, file tree
- **Environment**: Active environment, variables
- **History**: Recent requests from database

### authStore

Manages OAuth/OIDC authentication:
- OIDC configuration and discovery
- Access/refresh tokens
- User info

### scriptStore

Manages pre/post-request script execution:
- Test results
- Console logs
- Script variables

### settingsStore

Manages user preferences:
- Editor settings (font, tab size, minimap)
- UI preferences
- Persisted to localStorage

## Key Features

### Variable Substitution

- **Environment variables**: `{{variableName}}`
- **Inline variables**: `@variableName = value`
- **Dynamic variables**: `$uuid`, `$timestamp`, `$randomInt`, etc.
- **Response extraction**: Store values from responses

### Script Support

Pre-request and post-request scripts using JavaScript:

```http
GET https://api.example.com/users

< {%
  // Pre-request script
  request.headers["X-Custom"] = "value";
%}

> {%
  // Post-request script
  client.test("Status is 200", () => {
    client.assert(response.status === 200);
  });
  client.global.set("userId", response.body.id);
%}
```

### Dual Editor Mode

- **Source view**: Monaco editor with .http syntax highlighting
- **GUI view**: Form-based editor for method, URL, headers, body

### Request History

SQLite database storing:
- Request details (method, URL, headers, body)
- Response details (status, headers, body, timing)
- Timestamps for chronological browsing

## Configuration

### tauri.conf.json

- Window: 1200x800 default, 800x600 minimum
- CSP: Disabled for development
- Bundle: PNG icons

### Persistence

Zustand stores persist to localStorage (`kvile-storage`):
- `isDarkMode`
- `activeEnvironment`
- `workspacePath`
- `sidebarVisible`
- `activeEditorView`

## Development

```bash
# Run development server
WEBKIT_DISABLE_COMPOSITING_MODE=1 npm run tauri dev

# Build for production
npm run tauri build

# Run Rust tests
cd src-tauri && cargo test

# Run frontend tests
npm run test:run
```

## Known Issues

- **Wayland**: May require `WEBKIT_DISABLE_COMPOSITING_MODE=1`
- **Icons**: Must be RGBA PNG format for Tauri
