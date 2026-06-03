#!/bin/bash

# Always run from the directory where this script lives
cd "$(dirname "$0")"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║         TradeDesk — Setup & Run          ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌  Node.js not found. Please install from https://nodejs.org"
    exit 1
fi

echo "✓ Node.js $(node -v) found"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo ""
    echo "📦 Installing dependencies..."
    npm install
    echo "✓ Dependencies installed"
fi

echo ""
echo "🚀 Starting TradeDesk..."
echo "   Open your browser at: http://localhost:3000"
echo "   Press Ctrl+C to stop"
echo ""

node server.js
