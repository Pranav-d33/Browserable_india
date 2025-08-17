#!/bin/bash

# =============================================================================
# Bharat Agents - Environment Setup Script
# =============================================================================
# 
# This script helps developers set up their environment configuration files.
# It copies example files and provides guidance for configuration.
# =============================================================================

set -e

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

# Function to check if file exists
file_exists() {
    if [ -f "$1" ]; then
        return 0
    else
        return 1
    fi
}

# Function to backup existing file
backup_file() {
    local file="$1"
    if file_exists "$file"; then
        local backup="${file}.backup.$(date +%Y%m%d_%H%M%S)"
        cp "$file" "$backup"
        print_warning "Backed up existing $file to $backup"
    fi
}

# Function to copy example file
copy_example() {
    local example="$1"
    local target="$2"
    
    if file_exists "$example"; then
        backup_file "$target"
        cp "$example" "$target"
        print_success "Created $target from $example"
    else
        print_error "Example file $example not found"
        return 1
    fi
}

# Main setup function
main() {
    print_status "Setting up Bharat Agents environment configuration..."
    
    # Check if we're in the right directory
    if [ ! -f "package.json" ]; then
        print_error "Please run this script from the project root directory"
        exit 1
    fi
    
    # Create .env files from examples
    print_status "Creating environment configuration files..."
    
    # Root level
    if copy_example "env.example" ".env"; then
        print_warning "Please update .env with your actual values"
    fi
    
    # Tasks service
    if [ -d "apps/tasks" ]; then
        if copy_example "apps/tasks/env.example" "apps/tasks/.env.development.local"; then
            print_warning "Please update apps/tasks/.env.development.local with your actual values"
        fi
    fi
    
    # Browser service
    if [ -d "apps/browser" ]; then
        if copy_example "apps/browser/env.example" "apps/browser/.env.development.local"; then
            print_warning "Please update apps/browser/.env.development.local with your actual values"
        fi
    fi
    
    # Deployment
    if [ -d "infra/deployment" ]; then
        if copy_example "infra/deployment/env.example" "infra/deployment/.env"; then
            print_warning "Please update infra/deployment/.env with your actual values"
        fi
    fi
    
    print_success "Environment setup complete!"
    
    # Provide next steps
    echo
    print_status "Next steps:"
    echo "1. Update the .env files with your actual values"
    echo "2. Start the infrastructure: cd infra/deployment && make up"
    echo "3. Start the services: pnpm dev"
    echo ""
    print_status "Infrastructure management:"
    echo "  make up          # Start all services"
    echo "  make down        # Stop all services"
    echo "  make logs        # Show service logs"
    echo "  make nuke        # Stop services and remove volumes"
    echo "  make status      # Show service status"
    echo
    print_status "For production, consider using secret management tools:"
    echo "- Doppler (recommended): https://docs.doppler.com/"
    echo "- 1Password CLI: https://developer.1password.com/docs/cli/"
    echo "- AWS SSM Parameter Store: https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html"
    echo
    print_status "See docs/SECRET_MANAGEMENT.md for detailed instructions"
}

# Run main function
main "$@"
