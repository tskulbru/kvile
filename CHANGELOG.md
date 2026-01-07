# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1](https://github.com/tskulbru/kvile/compare/kvile-v0.2.0...kvile-v0.2.1) (2026-01-07)


### Features

* add environment management UI with public/private differentiation ([262aced](https://github.com/tskulbru/kvile/commit/262acedf9e4efbb20101a74f475875dea2dfaa53))
* add Kvile app icon and branding ([2ba6b56](https://github.com/tskulbru/kvile/commit/2ba6b56137e8fe0dc7912f52b70346f83af80fb4))

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
