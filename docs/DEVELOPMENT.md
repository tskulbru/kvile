# Development Guide

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://rustup.rs/) (latest stable)
- [Tauri CLI](https://tauri.app/start/prerequisites/)

### Linux Dependencies

```bash
# Debian/Ubuntu
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libssl-dev libayatana-appindicator3-dev librsvg2-dev

# Fedora
sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file \
  libappindicator-gtk3-devel librsvg2-devel

# Arch
sudo pacman -S webkit2gtk-4.1 base-devel curl wget file openssl \
  libappindicator-gtk3 librsvg
```

## Quick Start

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Linux/Wayland: if you encounter display issues
WEBKIT_DISABLE_COMPOSITING_MODE=1 npm run tauri dev
# or
GDK_BACKEND=x11 npm run tauri dev
```

## Project Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server (frontend only) |
| `npm run build` | Build frontend for production |
| `npm run tauri dev` | Run full Tauri development mode |
| `npm run tauri build` | Build production desktop app |
| `npm run test` | Run frontend tests in watch mode |
| `npm run test:run` | Run frontend tests once |

## Testing

### Frontend Tests (Vitest)

```bash
# Run tests in watch mode
npm run test

# Run tests once
npm run test:run
```

Test files are located alongside source files with `.test.ts` extension:
- `src/stores/appStore.test.ts`
- `src/lib/tauri.test.ts`

### Rust Tests

```bash
cd src-tauri
cargo test
```

Test modules are included in the source files:
- `src-tauri/src/parser/jetbrains.rs`
- `src-tauri/src/parser/vscode.rs`
- `src-tauri/src/parser/detect.rs`

## Building

### Development Build

```bash
npm run tauri dev
```

Hot-reloads both frontend (Vite) and backend (Cargo).

### Production Build

```bash
npm run tauri build
```

Outputs are in `src-tauri/target/release/bundle/`:
- `.deb` (Debian/Ubuntu)
- `.rpm` (Fedora/RHEL)
- `.AppImage` (Universal Linux)
- `.dmg` (macOS)
- `.msi` / `.exe` (Windows)

## Code Patterns

### Tauri IPC Commands

#### Rust Side

```rust
// src-tauri/src/commands.rs
#[tauri::command]
pub async fn my_command(arg: String) -> Result<MyResponse, String> {
    // Implementation
    Ok(MyResponse { /* ... */ })
}
```

Register in `lib.rs`:
```rust
.invoke_handler(tauri::generate_handler![
    my_command,
    // ... other commands
])
```

#### TypeScript Side

```typescript
// src/lib/tauri.ts
import { invoke } from "@tauri-apps/api/core";

export async function myCommand(arg: string): Promise<MyResponse> {
  return invoke<MyResponse>("my_command", { arg });
}
```

### Zustand Stores

```typescript
// src/stores/myStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface MyState {
  value: string;
  setValue: (value: string) => void;
}

export const useMyStore = create<MyState>()(
  persist(
    (set) => ({
      value: "",
      setValue: (value) => set({ value }),
    }),
    {
      name: "kvile-my-storage",
      partialize: (state) => ({ value: state.value }), // Only persist these fields
    }
  )
);
```

### Monaco Editor Language

Custom language registration in `HttpEditor.tsx`:

```typescript
monaco.languages.register({ id: "http" });
monaco.languages.setMonarchTokensProvider("http", {
  tokenizer: {
    root: [
      [/^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\b/, "keyword"],
      [/\{\{[^}]+\}\}/, "variable"],
      [/^#.*$/, "comment"],
      // ... more rules
    ],
  },
});
```

### Adding UI Components (shadcn/ui)

Components are in `src/components/ui/`. To add new shadcn components:

```bash
# shadcn/ui components are copy-pasted, not installed
# Visit: https://ui.shadcn.com/docs/components/[component]
# Copy the code into src/components/ui/
```

## Tauri 2 Capabilities

Security permissions are defined in `src-tauri/capabilities/default.json`:

```json
{
  "identifier": "default",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "fs:default",
    "fs:allow-read",
    "fs:allow-write",
    "dialog:default",
    "dialog:allow-open",
    "shell:default"
  ]
}
```

See [Tauri Capabilities](https://tauri.app/develop/capability/) for available permissions.

## Dependencies

### Frontend (package.json)

| Package | Purpose |
|---------|---------|
| `@tauri-apps/api` | Tauri JavaScript API |
| `@tauri-apps/plugin-*` | Tauri plugin bindings |
| `@monaco-editor/react` | Monaco editor React wrapper |
| `zustand` | Lightweight state management |
| `@radix-ui/react-*` | Headless UI primitives |
| `lucide-react` | Icon library |
| `tailwind-merge` + `clsx` | Class name utilities |
| `diff` | Response comparison |

### Backend (Cargo.toml)

| Crate | Purpose |
|-------|---------|
| `tauri` | Desktop framework |
| `tauri-plugin-*` | Plugin implementations |
| `reqwest` | Async HTTP client |
| `tokio` | Async runtime |
| `serde` / `serde_json` | Serialization |
| `regex` | HTTP file parsing |
| `rusqlite` | SQLite for history |
| `notify` | File system watching |
| `chrono` | Date/time handling |
| `base64` / `sha2` / `rand` | OIDC/OAuth support |
| `url` / `urlencoding` | URL handling |

## Code Style

### Rust

```bash
# Format code
cargo fmt

# Lint
cargo clippy
```

- Use `Result<T, String>` for Tauri commands (errors shown to user)
- Prefix unused variables with `_`
- Use `thiserror` for custom error types

### TypeScript

- Strict mode enabled
- Prefer `interface` over `type` for object shapes
- Use named exports
- Async functions for Tauri IPC calls

### React

- Functional components only
- Custom hooks for reusable logic (`src/hooks/`)
- Zustand for global state
- Tailwind for styling (no CSS modules)

## Troubleshooting

### Icons Error

```
failed to open icon: No such file or directory
```

Ensure RGBA PNG icons exist in `src-tauri/icons/`:
- `icon.png` (512x512)
- `32x32.png`
- `128x128.png`
- `128x128@2x.png`

### Wayland Display Issues

```
Gdk-Message: Error dispatching to Wayland display
```

```bash
WEBKIT_DISABLE_COMPOSITING_MODE=1 npm run tauri dev
# or force X11
GDK_BACKEND=x11 npm run tauri dev
```

### Plugin Configuration Error

```
unknown field `scope`, expected `requireLiteralLeadingDot`
```

Use capabilities files (`src-tauri/capabilities/`) instead of plugin config in `tauri.conf.json`.

### SQLite Bundling Issues

The `rusqlite` crate uses the `bundled` feature to compile SQLite from source:

```toml
rusqlite = { version = "0.31", features = ["bundled"] }
```

This requires a C compiler. On Linux, ensure `build-essential` (Debian) or equivalent is installed.

### Hot Reload Not Working

If changes aren't reflecting:
1. Frontend: Check Vite terminal for errors
2. Backend: Rust changes require recompilation (automatic in dev mode)
3. Try restarting `npm run tauri dev`

## Adding New Features

### New Tauri Command

1. Add function in `src-tauri/src/commands.rs` (or new module)
2. Register in `src-tauri/src/lib.rs` invoke_handler
3. Add TypeScript wrapper in `src/lib/tauri.ts`
4. Call from React components

### New UI Panel

1. Create component in `src/components/[Feature]/`
2. Add state to appropriate Zustand store
3. Add toggle in `Sidebar.tsx` or `MainContent.tsx`
4. Register keyboard shortcut in `src/lib/shortcuts.ts` if needed

### New File Format Support

1. Add parser in `src-tauri/src/parser/`
2. Update detection logic in `detect.rs`
3. Add tests for the new format
