#!/bin/bash

# =============================================================================
# Local Development Setup Script for Bharat Agents
# =============================================================================

set -e  # Exit on any error

echo "🚀 Setting up Bharat Agents for local development..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -f "pnpm-workspace.yaml" ]; then
    print_error "Please run this script from the root directory of the project"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    print_error "Node.js 20+ is required. Current version: $(node --version)"
    print_error "Please install Node.js 20+ from https://nodejs.org/"
    exit 1
fi

print_success "Node.js version: $(node --version)"

# Check pnpm
if ! command -v pnpm &> /dev/null; then
    print_error "pnpm is not installed. Please install it with: npm install -g pnpm"
    exit 1
fi

print_success "pnpm version: $(pnpm --version)"

# Install dependencies
print_status "Installing dependencies..."
pnpm install

# Build the project
print_status "Building the project..."
pnpm -w build

# Setup environment files
print_status "Setting up environment files..."

# Copy environment example for tasks app
if [ ! -f "apps/tasks/.env.local" ]; then
    cp "apps/tasks/env.local.example" "apps/tasks/.env.local"
    print_success "Created apps/tasks/.env.local"
    print_warning "Please update GEMINI_API_KEY in apps/tasks/.env.local"
else
    print_status "apps/tasks/.env.local already exists"
fi

# Copy environment example for browser app
if [ ! -f "apps/browser/.env.local" ]; then
    cp "apps/browser/env.example" "apps/browser/.env.local"
    print_success "Created apps/browser/.env.local"
else
    print_status "apps/browser/.env.local already exists"
fi

# Install Playwright browsers
print_status "Installing Playwright browsers..."
npx playwright install

# Create uploads directory
print_status "Creating uploads directory..."
mkdir -p uploads/public uploads/private

# Check if Gemini API key is set
if [ -f "apps/tasks/.env.local" ]; then
    if grep -q "your_gemini_api_key_here" "apps/tasks/.env.local"; then
        print_warning "⚠️  Please update GEMINI_API_KEY in apps/tasks/.env.local"
        print_status "Get a free API key from: https://makersuite.google.com/app/apikey"
    else
        print_success "Gemini API key appears to be configured"
    fi
fi

# Display next steps
echo ""
print_success "🎉 Setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. Update GEMINI_API_KEY in apps/tasks/.env.local"
echo "2. Start the tasks service: pnpm --filter @bharat-agents/tasks dev"
echo "3. Start the browser service: pnpm --filter @bharat-agents/browser dev"
echo ""
echo "API endpoints will be available at:"
echo "- Tasks API: http://localhost:3001"
echo "- Browser API: http://localhost:3002"
echo ""
echo "For more information, see the README.md file"
