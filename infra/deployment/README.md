# Development Infrastructure

This directory contains the Docker Compose configuration for the Bharat Agents development environment.

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Make (optional, for convenience commands)

### Setup

1. **Copy environment template:**

   ```bash
   cp env.example .env
   ```

2. **Update environment variables:**

   ```bash
   # Edit .env with your preferred values
   # Defaults are provided for local development
   ```

3. **Start infrastructure:**

   ```bash
   # Using Make (recommended)
   make up

   # Or using Docker Compose directly
   docker-compose -f docker-compose.dev.yml up -d
   ```

## 📋 Services

### PostgreSQL 16

- **Purpose**: Primary database
- **Port**: 5432
- **Database**: `bharat_agents`
- **Credentials**: `bharat_user` / `bharat_password`
- **Volume**: `bharat-agents-pgdata`
- **Health Check**: ✅

### Redis 7

- **Purpose**: Caching and session storage
- **Port**: 6379
- **Password**: Configurable via `REDIS_PASSWORD`
- **Volume**: `bharat-agents-redis-data`
- **Health Check**: ✅

### MinIO

- **Purpose**: S3-compatible object storage
- **API Port**: 9000
- **Console Port**: 9001
- **Credentials**: `minioadmin` / `minioadmin`
- **Volume**: `bharat-agents-minio-data`
- **Buckets**: `artifacts` (auto-created)
- **Health Check**: ✅

### MailHog

- **Purpose**: Email testing for OTP flows
- **Web UI Port**: 8025
- **SMTP Port**: 1025
- **Health Check**: ✅

## 🛠️ Management Commands

### Using Make (Linux/macOS)

```bash
# Start all services
make up

# Stop all services
make down

# Show service logs
make logs

# Show logs for specific service
make logs LOGS_SERVICE=postgres

# Stop services and remove volumes (⚠️ DESTRUCTIVE)
make nuke

# Restart all services
make restart

# Show service status
make status

# Check environment variables
make env-check

# Database management
make db-reset    # Reset database (⚠️ DESTRUCTIVE)
make db-backup   # Create database backup

# MinIO management
make minio-init  # Initialize buckets
make minio-reset # Reset MinIO data (⚠️ DESTRUCTIVE)

# Development utilities
make shell SHELL_SERVICE=postgres  # Open shell in service
make health                        # Check service health
```

### Using Batch File (Windows)

```cmd
# Start all services
Makefile.bat up

# Stop all services
Makefile.bat down

# Show service logs
Makefile.bat logs

# Show logs for specific service
Makefile.bat logs postgres

# Stop services and remove volumes (⚠️ DESTRUCTIVE)
Makefile.bat nuke

# Restart all services
Makefile.bat restart

# Show service status
Makefile.bat status
```

### Using Docker Compose Directly

```bash
# Start all services
docker-compose -f docker-compose.dev.yml up -d

# Stop all services
docker-compose -f docker-compose.dev.yml down

# Show logs
docker-compose -f docker-compose.dev.yml logs -f

# Show logs for specific service
docker-compose -f docker-compose.dev.yml logs -f postgres

# Stop and remove volumes
docker-compose -f docker-compose.dev.yml down -v

# Show service status
docker-compose -f docker-compose.dev.yml ps
```

## 🔧 Configuration

### Environment Variables

All services are configured via environment variables. See `env.example` for the complete list:

| Variable              | Description         | Default           |
| --------------------- | ------------------- | ----------------- |
| `POSTGRES_DB`         | Database name       | `bharat_agents`   |
| `POSTGRES_USER`       | Database user       | `bharat_user`     |
| `POSTGRES_PASSWORD`   | Database password   | `bharat_password` |
| `POSTGRES_PORT`       | Database port       | `5432`            |
| `REDIS_PASSWORD`      | Redis password      | (empty)           |
| `REDIS_PORT`          | Redis port          | `6379`            |
| `MINIO_ROOT_USER`     | MinIO access key    | `minioadmin`      |
| `MINIO_ROOT_PASSWORD` | MinIO secret key    | `minioadmin`      |
| `MINIO_PORT`          | MinIO API port      | `9000`            |
| `MINIO_CONSOLE_PORT`  | MinIO console port  | `9001`            |
| `MAILHOG_PORT`        | MailHog web UI port | `8025`            |
| `MAILHOG_SMTP_PORT`   | MailHog SMTP port   | `1025`            |

### Networks

- **`bharat-agents-core`**: Internal network for service communication

### Volumes

- **`bharat-agents-pgdata`**: PostgreSQL data persistence
- **`bharat-agents-redis-data`**: Redis data persistence
- **`bharat-agents-minio-data`**: MinIO data persistence

## 🔍 Monitoring

### Service URLs

Once started, you can access:

- **PostgreSQL**: `localhost:5432`
- **Redis**: `localhost:6379`
- **MinIO API**: `localhost:9000`
- **MinIO Console**: `http://localhost:9001`
- **MailHog**: `http://localhost:8025`

### Health Checks

All services include health checks:

```bash
# Check health status
make health

# Or using Docker Compose
docker-compose -f docker-compose.dev.yml ps
```

### Logs

```bash
# All services
make logs

# Specific service
make logs LOGS_SERVICE=postgres
make logs LOGS_SERVICE=redis
make logs LOGS_SERVICE=minio
make logs LOGS_SERVICE=mailhog
```

## 🗄️ Database Management

### Initialization

The PostgreSQL service automatically runs `init.sql` on first startup to create the database schema.

### Backups

```bash
# Create backup
make db-backup

# Backups are stored in ./backups/
```

### Reset Database

```bash
# ⚠️ WARNING: This will delete all data!
make db-reset
```

## 📦 MinIO Management

### Bucket Initialization

The `artifacts` bucket is automatically created with public read access.

### Manual Bucket Management

```bash
# Access MinIO console
open http://localhost:9001

# Or use MinIO client
docker-compose -f docker-compose.dev.yml exec minio-client mc ls local/
```

## 📧 Email Testing

### MailHog

MailHog captures all emails sent by the application for testing:

- **Web UI**: `http://localhost:8025`
- **SMTP**: `localhost:1025`

### Testing Email Sending

```bash
# Test SMTP connection
telnet localhost 1025

# Send test email
echo "Subject: Test" | nc localhost 1025
```

## 🚨 Troubleshooting

### Common Issues

1. **Port conflicts**

   ```bash
   # Check what's using the port
   lsof -i :5432

   # Change port in .env
   POSTGRES_PORT=5433
   ```

2. **Permission issues**

   ```bash
   # Fix volume permissions
   sudo chown -R 999:999 /var/lib/docker/volumes/bharat-agents-*
   ```

3. **Service won't start**

   ```bash
   # Check logs
   make logs

   # Check environment
   make env-check
   ```

4. **Data corruption**
   ```bash
   # Reset everything
   make nuke
   make up
   ```

### Debug Mode

```bash
# Start with debug output
docker-compose -f docker-compose.dev.yml up

# Check service health
docker-compose -f docker-compose.dev.yml ps
```

### Cleanup

```bash
# Remove unused resources
make clean

# Remove everything
make nuke
```

## 🔒 Security Notes

- **Development Only**: This configuration is for development only
- **Default Credentials**: Change default passwords in production
- **Network Isolation**: Services communicate via internal Docker network
- **Volume Persistence**: Data persists between container restarts

## 📚 Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [PostgreSQL Docker Image](https://hub.docker.com/_/postgres)
- [Redis Docker Image](https://hub.docker.com/_/redis)
- [MinIO Documentation](https://docs.min.io/)
- [MailHog Documentation](https://github.com/mailhog/MailHog)
