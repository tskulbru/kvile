# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.2](https://github.com/tskulbru/kvile/compare/kvile-v0.2.1...kvile-v0.2.2) (2026-02-16)


### Bug Fixes

* change bundle identifier to avoid .app suffix conflict on macOS ([1f2dfb0](https://github.com/tskulbru/kvile/commit/1f2dfb02c3ad8e99d967f1537d5f22b5dc108b02)), closes [#4](https://github.com/tskulbru/kvile/issues/4)
* resolve empty workspace spinner loop and add New File functionality ([edd8764](https://github.com/tskulbru/kvile/commit/edd876443c8a0fb926c9a23f7db6dd5d69e8b5bf)), closes [#3](https://github.com/tskulbru/kvile/issues/3)
* sync Cargo.toml version and fix release-please TOML updater config ([4341c21](https://github.com/tskulbru/kvile/commit/4341c21b934bfcaee2d1f8f9f87efcc54995c1bd))

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
