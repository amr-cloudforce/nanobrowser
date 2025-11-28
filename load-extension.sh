#!/bin/bash

# Script to build Nanobrowser extension

DIST_FOLDER="$(pwd)/dist"

# Fix pnpm cache directory issue
export PNPM_HOME="${PNPM_HOME:-$HOME/.local/share/pnpm}"
mkdir -p "$PNPM_HOME/.tools/pnpm" 2>/dev/null || true

# Check Node version and use nvm if available
if [ -f .nvmrc ]; then
  if [ -s "$HOME/.nvm/nvm.sh" ]; then
    echo "📦 Switching to Node version from .nvmrc..."
    source "$HOME/.nvm/nvm.sh"
    nvm use
  elif [ -n "$NVM_DIR" ] && [ -s "$NVM_DIR/nvm.sh" ]; then
    source "$NVM_DIR/nvm.sh"
    nvm use
  fi
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  pnpm install
fi

echo "🚀 Building Nanobrowser extension..."
# Build dependencies first, then the extension
if pnpm turbo ready && pnpm turbo build 2>&1; then
  echo ""
  echo "✅ Build complete!"
else
  echo ""
  echo "⚠️  Build had issues, but checking if dist folder exists..."
fi

if [ -d "$DIST_FOLDER" ]; then
  echo ""
  echo "📦 Load this folder in Chrome:"
  echo "   $DIST_FOLDER"
  echo ""
else
  echo ""
  echo "❌ Build folder not found. Build must succeed first."
  echo ""
  echo "💡 Fix Node version (needs >=22.12.0):"
  echo "   nvm use"
  echo "   Then run: pnpm build"
  exit 1
fi

