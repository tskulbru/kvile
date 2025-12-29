<p align="center">
  <img src="src-tauri/icons/128x128.png" alt="Kvile Logo" width="100" height="100">
</p>

<h1 align="center">Kvile</h1>

<p align="center">
  <em>A fast, lightweight HTTP client focused on <code>.http</code> file support.</em><br>
  <em>Built with Tauri, React, and Rust.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License">
  <img src="https://img.shields.io/badge/platform-Linux%20%7C%20macOS%20%7C%20Windows-lightgrey" alt="Platform">
  <img src="https://img.shields.io/badge/built%20with-Tauri%202-blue" alt="Built with Tauri">
</p>

<p align="center">
  <strong>Kvile</strong> (Norwegian for "rest") is an open-source HTTP debugging application designed for working with <code>.http</code> files. It treats <code>.http</code> files as first-class citizens, making it ideal for developers who prefer plain-text, git-friendly API collections.
</p>

---

## Features

- **Native `.http` file support** - JetBrains, VS Code REST Client, and Kulala formats with auto-detection
- **Dual editor mode** - Switch between source editing (Monaco) and GUI form editor
- **Environment variables** - Multiple environments with variable substitution
- **Pre/post-request scripts** - JavaScript scripting with assertions and variable extraction
- **Request history** - SQLite-backed history with search
- **OAuth/OIDC support** - Built-in authentication flows
- **cURL import** - Convert cURL commands to `.http` format
- **Response comparison** - Diff view for comparing responses
- **File watching** - Auto-reload when files change externally
- **Keyboard-driven** - Command palette and shortcuts for power users
- **Lightweight** - ~10 MB bundle, ~40 MB memory, sub-second startup
- **Offline-first** - No account required, no telemetry

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) (latest stable)
- Platform-specific dependencies (see below)

#### Linux (Debian/Ubuntu)
```bash
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

#### Linux (Arch)
```bash
sudo pacman -S webkit2gtk-4.1 base-devel curl wget file openssl \
  libappindicator-gtk3 librsvg
```

#### macOS
```bash
xcode-select --install
```

#### Windows
- Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- Install [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

### Build from Source

```bash
# Clone the repository
git clone https://github.com/tskulbru/kvile.git
cd kvile

# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

#### Wayland Users

If you experience display issues on Linux with Wayland:

```bash
WEBKIT_DISABLE_COMPOSITING_MODE=1 npm run tauri dev
# or
GDK_BACKEND=x11 npm run tauri dev
```

## HTTP File Formats

Kvile supports multiple `.http` file specifications with automatic format detection.

### JetBrains HTTP Client
```http
### Get all users
GET https://api.example.com/users
Authorization: Bearer {{auth_token}}

### Create user
POST https://api.example.com/users
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com"
}

> {%
  client.global.set("user_id", response.body.id);
%}
```

### VS Code REST Client
```http
@baseUrl = https://api.example.com
@authToken = your-token-here

###
GET {{baseUrl}}/users
Authorization: Bearer {{authToken}}
```

### Kulala Extensions
```http
# @name CreateUser
# @prompt username Enter username

POST https://api.example.com/users
Content-Type: application/json

{"username": "{{username}}"}
```

### Dynamic Variables

| Variable | Description |
|----------|-------------|
| `{{$uuid}}` | Generate UUID v4 |
| `{{$timestamp}}` | Current Unix timestamp |
| `{{$randomInt}}` | Random integer |
| `{{$datetime}}` | Current ISO datetime |

## Documentation

- [Architecture Overview](docs/ARCHITECTURE.md) - System design and structure
- [Development Guide](docs/DEVELOPMENT.md) - Setup, testing, and contributing
- [Project Vision](docs/VISION.md) - Goals and roadmap

## Contributing

Contributions are welcome! Please see our [Development Guide](docs/DEVELOPMENT.md) for setup instructions.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Guidelines

- Follow existing code style
- Write tests for new functionality
- Update documentation as needed
- Keep commits atomic and well-described

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- [Tauri](https://tauri.app/) - Desktop framework
- [JetBrains HTTP Client](https://www.jetbrains.com/help/idea/http-client-in-product-code-editor.html) - HTTP file specification
- [VS Code REST Client](https://github.com/Huachao/vscode-restclient) - HTTP file format
- [Kulala](https://github.com/mistweaverco/kulala.nvim) - Additional HTTP file extensions

---

<p align="center">
  <img src="src-tauri/icons/32x32.png" alt="Kvile" width="20" height="20"><br>
  <sub>Made with care for developers who value simplicity</sub>
</p>
