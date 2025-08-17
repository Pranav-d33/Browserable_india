# =============================================================================
# Bharat Agents - Development Infrastructure Makefile
# =============================================================================
# 
# This Makefile provides convenient commands for managing the development
# infrastructure using Docker Compose.
# =============================================================================

# Configuration
COMPOSE_FILE := docker-compose.dev.yml
PROJECT_NAME := bharat-agents

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[1;33m
RED := \033[0;31m
NC := \033[0m # No Color

# Default target
.DEFAULT_GOAL := help

# =============================================================================
# Help
# =============================================================================
.PHONY: help
help: ## Show this help message
	@echo "$(BLUE)Bharat Agents - Development Infrastructure$(NC)"
	@echo ""
	@echo "$(YELLOW)Available commands:$(NC)"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(GREEN)%-15s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(YELLOW)Usage:$(NC)"
	@echo "  make up          # Start all services"
	@echo "  make down        # Stop all services"
	@echo "  make logs        # Show service logs"
	@echo "  make nuke        # Stop services and remove volumes"
	@echo "  make restart     # Restart all services"
	@echo "  make status      # Show service status"
	@echo ""

# =============================================================================
# Service Management
# =============================================================================
.PHONY: up
up: ## Start all development services
	@echo "$(BLUE)Starting Bharat Agents development infrastructure...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) -p $(PROJECT_NAME) up -d
	@echo "$(GREEN)✅ Services started successfully!$(NC)"
	@echo ""
	@echo "$(YELLOW)Service URLs:$(NC)"
	@echo "  PostgreSQL: localhost:$(shell grep POSTGRES_PORT .env 2>/dev/null | cut -d'=' -f2 || echo "5432")"
	@echo "  Redis:      localhost:$(shell grep REDIS_PORT .env 2>/dev/null | cut -d'=' -f2 || echo "6379")"
	@echo "  MinIO:      localhost:$(shell grep MINIO_PORT .env 2>/dev/null | cut -d'=' -f2 || echo "9000")"
	@echo "  MinIO UI:   localhost:$(shell grep MINIO_CONSOLE_PORT .env 2>/dev/null | cut -d'=' -f2 || echo "9001")"
	@echo "  MailHog:    localhost:$(shell grep MAILHOG_PORT .env 2>/dev/null | cut -d'=' -f2 || echo "8025")"
	@echo ""
	@echo "$(YELLOW)Default credentials:$(NC)"
	@echo "  PostgreSQL: $(shell grep POSTGRES_USER .env 2>/dev/null | cut -d'=' -f2 || echo "bharat_user")/$(shell grep POSTGRES_PASSWORD .env 2>/dev/null | cut -d'=' -f2 || echo "bharat_password")"
	@echo "  MinIO:      $(shell grep MINIO_ROOT_USER .env 2>/dev/null | cut -d'=' -f2 || echo "minioadmin")/$(shell grep MINIO_ROOT_PASSWORD .env 2>/dev/null | cut -d'=' -f2 || echo "minioadmin")"

.PHONY: down
down: ## Stop all development services
	@echo "$(BLUE)Stopping Bharat Agents development infrastructure...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) -p $(PROJECT_NAME) down
	@echo "$(GREEN)✅ Services stopped successfully!$(NC)"

.PHONY: restart
restart: ## Restart all development services
	@echo "$(BLUE)Restarting Bharat Agents development infrastructure...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) -p $(PROJECT_NAME) restart
	@echo "$(GREEN)✅ Services restarted successfully!$(NC)"

.PHONY: logs
logs: ## Show service logs (use LOGS_SERVICE=<service> for specific service)
	@if [ -n "$(LOGS_SERVICE)" ]; then \
		echo "$(BLUE)Showing logs for $(LOGS_SERVICE)...$(NC)"; \
		docker-compose -f $(COMPOSE_FILE) -p $(PROJECT_NAME) logs -f $(LOGS_SERVICE); \
	else \
		echo "$(BLUE)Showing logs for all services...$(NC)"; \
		docker-compose -f $(COMPOSE_FILE) -p $(PROJECT_NAME) logs -f; \
	fi

.PHONY: status
status: ## Show service status
	@echo "$(BLUE)Service Status:$(NC)"
	@docker-compose -f $(COMPOSE_FILE) -p $(PROJECT_NAME) ps

# =============================================================================
# Data Management
# =============================================================================
.PHONY: nuke
nuke: ## Stop services and remove all volumes (⚠️ DESTRUCTIVE)
	@echo "$(RED)⚠️  WARNING: This will remove all data!$(NC)"
	@echo "$(RED)This action cannot be undone.$(NC)"
	@read -p "Are you sure you want to continue? (y/N): " confirm && [ "$$confirm" = "y" ] || exit 1
	@echo "$(BLUE)Stopping services and removing volumes...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) -p $(PROJECT_NAME) down -v
	@docker volume rm bharat-agents-pgdata bharat-agents-redis-data bharat-agents-minio-data 2>/dev/null || true
	@echo "$(GREEN)✅ All data removed successfully!$(NC)"

.PHONY: clean
clean: ## Remove stopped containers and unused networks
	@echo "$(BLUE)Cleaning up Docker resources...$(NC)"
	@docker container prune -f
	@docker network prune -f
	@echo "$(GREEN)✅ Cleanup completed!$(NC)"

# =============================================================================
# Database Management
# =============================================================================
.PHONY: db-reset
db-reset: ## Reset PostgreSQL database (⚠️ DESTRUCTIVE)
	@echo "$(RED)⚠️  WARNING: This will reset the database!$(NC)"
	@read -p "Are you sure you want to continue? (y/N): " confirm && [ "$$confirm" = "y" ] || exit 1
	@echo "$(BLUE)Resetting PostgreSQL database...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) -p $(PROJECT_NAME) down postgres
	@docker volume rm bharat-agents-pgdata 2>/dev/null || true
	@docker-compose -f $(COMPOSE_FILE) -p $(PROJECT_NAME) up -d postgres
	@echo "$(GREEN)✅ Database reset completed!$(NC)"

.PHONY: db-backup
db-backup: ## Create a backup of the PostgreSQL database
	@echo "$(BLUE)Creating database backup...$(NC)"
	@mkdir -p backups
	@docker-compose -f $(COMPOSE_FILE) -p $(PROJECT_NAME) exec -T postgres pg_dump -U $(shell grep POSTGRES_USER .env 2>/dev/null | cut -d'=' -f2 || echo "bharat_user") $(shell grep POSTGRES_DB .env 2>/dev/null | cut -d'=' -f2 || echo "bharat_agents") > backups/backup_$$(date +%Y%m%d_%H%M%S).sql
	@echo "$(GREEN)✅ Backup created successfully!$(NC)"

# =============================================================================
# MinIO Management
# =============================================================================
.PHONY: minio-init
minio-init: ## Initialize MinIO buckets
	@echo "$(BLUE)Initializing MinIO buckets...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) -p $(PROJECT_NAME) up minio-client
	@echo "$(GREEN)✅ MinIO buckets initialized!$(NC)"

.PHONY: minio-reset
minio-reset: ## Reset MinIO data (⚠️ DESTRUCTIVE)
	@echo "$(RED)⚠️  WARNING: This will reset MinIO data!$(NC)"
	@read -p "Are you sure you want to continue? (y/N): " confirm && [ "$$confirm" = "y" ] || exit 1
	@echo "$(BLUE)Resetting MinIO data...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) -p $(PROJECT_NAME) down minio
	@docker volume rm bharat-agents-minio-data 2>/dev/null || true
	@docker-compose -f $(COMPOSE_FILE) -p $(PROJECT_NAME) up -d minio
	@echo "$(GREEN)✅ MinIO data reset completed!$(NC)"

# =============================================================================
# Development Utilities
# =============================================================================
.PHONY: shell
shell: ## Open shell in a service (use SHELL_SERVICE=<service>)
	@if [ -z "$(SHELL_SERVICE)" ]; then \
		echo "$(RED)Error: Please specify a service with SHELL_SERVICE=<service>$(NC)"; \
		echo "Available services: postgres, redis, minio"; \
		exit 1; \
	fi
	@echo "$(BLUE)Opening shell in $(SHELL_SERVICE)...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) -p $(PROJECT_NAME) exec $(SHELL_SERVICE) sh

.PHONY: health
health: ## Check health of all services
	@echo "$(BLUE)Checking service health...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) -p $(PROJECT_NAME) ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

.PHONY: env-check
env-check: ## Check if required environment variables are set
	@echo "$(BLUE)Checking environment variables...$(NC)"
	@if [ ! -f .env ]; then \
		echo "$(RED)❌ .env file not found!$(NC)"; \
		echo "Please copy env.example to .env and update the values."; \
		exit 1; \
	fi
	@echo "$(GREEN)✅ .env file found!$(NC)"
	@echo "$(BLUE)Required variables:$(NC)"
	@echo "  POSTGRES_DB: $(shell grep POSTGRES_DB .env 2>/dev/null | cut -d'=' -f2 || echo "NOT SET")"
	@echo "  POSTGRES_USER: $(shell grep POSTGRES_USER .env 2>/dev/null | cut -d'=' -f2 || echo "NOT SET")"
	@echo "  POSTGRES_PASSWORD: $(shell grep POSTGRES_PASSWORD .env 2>/dev/null | cut -d'=' -f2 | sed 's/./*/g' || echo "NOT SET")"
	@echo "  MINIO_ROOT_USER: $(shell grep MINIO_ROOT_USER .env 2>/dev/null | cut -d'=' -f2 || echo "NOT SET")"
	@echo "  MINIO_ROOT_PASSWORD: $(shell grep MINIO_ROOT_PASSWORD .env 2>/dev/null | cut -d'=' -f2 | sed 's/./*/g' || echo "NOT SET")"

# =============================================================================
# Convenience Aliases
# =============================================================================
.PHONY: start
start: up ## Alias for up

.PHONY: stop
stop: down ## Alias for down

.PHONY: reset
reset: nuke up ## Reset everything and start fresh

.PHONY: ps
ps: status ## Alias for status
