#!/bin/bash
# Test script to verify the Ubuntu release build works
# This mimics the GitHub Actions workflow for ubuntu-22.04

set -e

echo "=== Starting Ubuntu build test in Docker ==="

docker run --rm \
  -v "$(pwd)":/workspace \
  -w /workspace \
  ubuntu:22.04 \
  bash -c '
    set -e

    echo "=== Step 1: Install system dependencies ==="
    apt-get update
    apt-get install -y \
      libwebkit2gtk-4.1-dev \
      libappindicator3-dev \
      librsvg2-dev \
      patchelf \
      curl \
      build-essential \
      pkg-config \
      libssl-dev \
      libgtk-3-dev \
      libsoup-3.0-dev \
      libjavascriptcoregtk-4.1-dev

    echo "=== Step 2: Install Node.js ==="
    curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
    apt-get install -y nodejs
    node --version
    npm --version

    echo "=== Step 3: Install Rust ==="
    curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    . "$HOME/.cargo/env"
    rustc --version
    cargo --version

    echo "=== Step 4: Install npm dependencies ==="
    npm ci

    echo "=== Step 5: Build Tauri app ==="
    npm run tauri build

    echo "=== Build completed successfully! ==="
    echo "=== Checking output artifacts ==="
    ls -la src-tauri/target/release/bundle/
  '
