# Kvile - Project Vision

## What We're Building

Kvile is a lightweight HTTP debugging application with a specific focus: **native support for the `.http` file specification**.

The name "Kvile" comes from Norwegian, meaning "rest" - fitting for a REST API client.

## The Problem

Current HTTP client tools have limitations:

1. **Proprietary formats**: Many tools use custom JSON/binary formats that don't diff well in git
2. **Account requirements**: Cloud sync often requires sign-up and internet connectivity
3. **Resource heavy**: Electron-based apps consume significant memory and storage
4. **IDE lock-in**: Some excellent `.http` support exists but only within specific IDEs

## Our Solution

A standalone, lightweight desktop application that:

- Treats `.http` files as first-class citizens
- Supports multiple specifications (JetBrains HTTP Client, VS Code REST Client, Kulala)
- Is fast and lightweight (Tauri, not Electron)
- Works completely offline with no account required
- Is git-friendly with plain text files

## Target Users

1. **Developers** who already use `.http` files in their projects
2. **Teams** who want version-controlled API collections
3. **Privacy-conscious users** who want local-only tooling
4. **Neovim/VS Code users** who want a companion GUI for their `.http` files

## Core Principles

### File-First
The `.http` file is the source of truth. No proprietary databases, no cloud storage - just files in your project that you control.

### Lightweight
Small bundle (~10 MB), low memory (~40 MB), sub-second startup. Your API client shouldn't slow down your machine.

### Offline
No internet required, no accounts, no telemetry. Your API requests stay on your machine.

### Git-Friendly
Plain text files that diff, merge, and review like any other code. Share collections via your existing git workflow.

### Cross-Platform
Linux, macOS, and Windows with native performance. Built with Tauri for a small footprint on every platform.

### Open Source
Community-driven development. Inspect the code, contribute features, fork if needed.

## Current Features

- Full `.http` file parsing (JetBrains, VS Code, Kulala formats)
- HTTP request execution with timing and size metrics
- Dual editor: source view (Monaco) and GUI form editor
- Environment variable support with multiple environments
- Pre/post-request JavaScript scripting with assertions
- Request history with SQLite storage
- File watching for external changes
- cURL import/conversion
- OAuth/OIDC authentication flows
- Response comparison (diff view)
- Keyboard-driven workflow with command palette

## Roadmap

### Near-Term
- Response body assertions and test reporting
- Collection runner for batch execution
- Request chaining with response variable extraction
- WebSocket support

### Medium-Term
- IDE extensions (VS Code, Neovim)
- GraphQL support
- Request templates and snippets
- Export to various formats

### Long-Term
- OpenAPI spec generation from `.http` files
- CI/CD integration for API testing
- Plugin system for extensibility

## Design Philosophy

### Simple Over Complex
Focus on doing `.http` files exceptionally well rather than adding every possible feature.

### Keyboard-First
Power users should be able to work without touching the mouse. Every action has a shortcut.

### Transparent
What you see is what's in the file. No hidden state, no magic transformations.

### Fast Feedback
Immediate response to actions. No spinners for local operations.
