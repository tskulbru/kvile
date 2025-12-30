# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2024-12-30

### Added

- Initial release of Kvile HTTP debugging application
- **Editor**: Monaco-based editor with `.http` file syntax highlighting
- **HTTP Client**: Execute HTTP requests directly from `.http` files
- **File Management**: Open folders, browse file tree, save edited files
- **Parser Support**: Parse both JetBrains and VS Code REST Client `.http` file formats
- **Theme**: Dark and light mode toggle
- **Cross-platform**: Builds for Linux (.deb, .rpm, .AppImage), macOS (.dmg), and Windows (.msi, .exe)

### Known Limitations

- Variable substitution (`{{var}}` syntax) not yet implemented
- Environment file parsing not yet implemented
- No file system watching (manual refresh required for external changes)
- Single request execution only (multi-request file support pending)
