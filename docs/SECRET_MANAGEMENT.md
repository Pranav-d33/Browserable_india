# Secret Management Guide

## Overview

This document outlines the secret management strategy for the Bharat Agents project. We follow a **secure-by-default** approach where no secrets are ever committed to version control.

## Security Principles

1. **Never commit secrets to version control**
2. **Use environment-specific configurations**
3. **Implement least-privilege access**
4. **Rotate secrets regularly**
5. **Audit secret access**

## Environment Files Structure

```
startup/
├── env.example                    # Root-level example (safe defaults)
├── .env                          # Root-level secrets (gitignored)
├── .env.development.local        # Development secrets (gitignored)
├── .env.production.local         # Production secrets (gitignored)
├── apps/
│   ├── tasks/
│   │   ├── env.example           # Tasks service example
│   │   └── .env.development.local # Tasks development secrets
│   └── browser/
│       ├── env.example           # Browser service example
│       └── .env.development.local # Browser development secrets
└── infra/deployment/
    ├── env.example               # Deployment example
    └── .env                      # Deployment secrets (gitignored)
```

## Required Environment Variables

### Core Variables (All Services)

| Variable         | Description                       | Example                               | Required |
| ---------------- | --------------------------------- | ------------------------------------- | -------- |
| `POSTGRES_URL`   | PostgreSQL connection URL         | `postgresql://user:pass@host:5432/db` | ✅       |
| `REDIS_URL`      | Redis connection URL              | `redis://localhost:6379/0`            | ✅       |
| `S3_ENDPOINT`    | S3-compatible storage endpoint    | `http://localhost:9000`               | ✅       |
| `S3_ACCESS_KEY`  | S3 access key                     | `minioadmin`                          | ✅       |
| `S3_SECRET_KEY`  | S3 secret key                     | `minioadmin`                          | ✅       |
| `JWT_SECRET`     | JWT signing secret (min 32 chars) | `openssl rand -base64 32`             | ✅       |
| `NODE_ENV`       | Node.js environment               | `development`                         | ✅       |
| `PORT`           | Application port                  | `3000`                                | ✅       |
| `OPENAI_API_KEY` | OpenAI API key (optional)         | `sk-...`                              | ❌       |

### Service-Specific Variables

#### Tasks Service

- `SERVICE_NAME=tasks`
- `PORT=3001`

#### Browser Service

- `SERVICE_NAME=browser`
- `PORT=3002`
- `BROWSER_TIMEOUT=30000`
- `BROWSER_HEADLESS=true`

## Secret Management Tools

### 1. Doppler (Recommended)

**Installation:**

```bash
# macOS
brew install dopplerhq/cli/doppler

# Linux
curl -Ls --tlsv1.2 --proto "=https" --retry 3 https://cli.doppler.com/install.sh | sh

# Windows
scoop install doppler
```

**Setup:**

```bash
# Initialize Doppler
doppler setup

# Create project
doppler projects create bharat-agents

# Create configurations
doppler setup --project bharat-agents --config dev
doppler setup --project bharat-agents --config staging
doppler setup --project bharat-agents --config prod
```

**Usage:**

```bash
# Run with Doppler
doppler run -- pnpm dev

# Run Docker Compose with Doppler
doppler run -- docker-compose up

# Export to .env file
doppler secrets download --format=env --no-file > .env
```

**Secrets Structure:**

```
bharat-agents/
├── dev/
│   ├── POSTGRES_URL
│   ├── REDIS_URL
│   ├── S3_ENDPOINT
│   ├── S3_ACCESS_KEY
│   ├── S3_SECRET_KEY
│   └── JWT_SECRET
├── staging/
│   └── [same structure]
└── prod/
    └── [same structure]
```

### 2. 1Password CLI

**Installation:**

```bash
# macOS
brew install 1password-cli

# Download from 1password.com for other platforms
```

**Setup:**

```bash
# Sign in to 1Password
op signin

# Create vault
op vault create bharat-agents
```

**Usage:**

```bash
# Run with 1Password
op run -- pnpm dev

# Export secrets
op item get "Bharat Agents Dev" --format=json | jq -r '.fields[] | "\(.id)=\(.value)"' > .env
```

### 3. AWS Systems Manager Parameter Store

**Setup:**

```bash
# Store secrets
aws ssm put-parameter \
  --name "/bharat-agents/dev/POSTGRES_URL" \
  --value "postgresql://user:pass@host:5432/db" \
  --type "SecureString"

aws ssm put-parameter \
  --name "/bharat-agents/dev/JWT_SECRET" \
  --value "$(openssl rand -base64 32)" \
  --type "SecureString"
```

**Retrieval in Application:**

```typescript
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const ssm = new SSMClient({ region: 'us-east-1' });

async function getSecret(name: string): Promise<string> {
  const command = new GetParameterCommand({
    Name: `/bharat-agents/${process.env.NODE_ENV}/${name}`,
    WithDecryption: true,
  });

  const response = await ssm.send(command);
  return response.Parameter?.Value || '';
}
```

### 4. HashiCorp Vault

**Installation:**

```bash
# Download from vaultproject.io
# Or use Docker
docker run -d --name vault -p 8200:8200 vault:latest
```

**Setup:**

```bash
# Initialize Vault
vault operator init

# Enable key-value secrets engine
vault secrets enable -path=bharat-agents kv-v2

# Store secrets
vault kv put bharat-agents/dev POSTGRES_URL="postgresql://user:pass@host:5432/db"
vault kv put bharat-agents/dev JWT_SECRET="$(openssl rand -base64 32)"
```

## Development Workflow

### Local Development

1. **Copy example files:**

   ```bash
   cp env.example .env
   cp apps/tasks/env.example apps/tasks/.env.development.local
   cp apps/browser/env.example apps/browser/.env.development.local
   ```

2. **Update with real values:**

   ```bash
   # Edit .env files with your local development values
   # Use safe defaults for local development
   ```

3. **Start services:**

   ```bash
   # Start infrastructure
   cd infra/deployment
   docker-compose up -d

   # Start services
   pnpm dev
   ```

### Production Deployment

1. **Set up secret management:**

   ```bash
   # Using Doppler
   doppler setup --project bharat-agents --config prod
   doppler secrets set POSTGRES_URL="postgresql://prod-user:prod-pass@prod-host:5432/prod-db"
   doppler secrets set JWT_SECRET="$(openssl rand -base64 32)"
   ```

2. **Deploy with secrets:**

   ```bash
   # Using Doppler
   doppler run -- docker-compose -f docker-compose.prod.yml up -d

   # Using 1Password
   op run -- docker-compose -f docker-compose.prod.yml up -d
   ```

## Security Best Practices

### 1. Secret Generation

**Generate strong secrets:**

```bash
# JWT Secret (32+ characters)
openssl rand -base64 32

# Database password
openssl rand -base64 16

# API keys
openssl rand -hex 32
```

### 2. Access Control

**Implement least-privilege:**

- Use dedicated database users with minimal permissions
- Create separate S3 buckets/users for different environments
- Use IAM roles instead of access keys where possible

### 3. Secret Rotation

**Regular rotation schedule:**

- JWT secrets: Every 90 days
- Database passwords: Every 180 days
- API keys: Every 365 days
- S3 access keys: Every 90 days

### 4. Monitoring and Auditing

**Monitor secret access:**

- Enable CloudTrail for AWS resources
- Use Vault audit logs
- Monitor Doppler access logs
- Set up alerts for unusual access patterns

## Troubleshooting

### Common Issues

1. **Environment variables not loading:**

   ```bash
   # Check if .env file exists
   ls -la .env*

   # Verify dotenv-flow is working
   echo $POSTGRES_URL
   ```

2. **Secret management tool not working:**

   ```bash
   # Test Doppler
   doppler secrets list

   # Test 1Password
   op item list

   # Test AWS SSM
   aws ssm get-parameter --name "/bharat-agents/dev/POSTGRES_URL"
   ```

3. **Permission denied errors:**

   ```bash
   # Check file permissions
   chmod 600 .env

   # Check AWS credentials
   aws sts get-caller-identity
   ```

### Debug Mode

**Enable debug logging:**

```bash
# Set debug environment variable
export DEBUG=dotenv-flow:*

# Run application
pnpm dev
```

## Migration Guide

### From .env files to Secret Management

1. **Export current secrets:**

   ```bash
   # Create backup
   cp .env .env.backup

   # Export to Doppler
   doppler secrets set POSTGRES_URL="$(grep POSTGRES_URL .env | cut -d'=' -f2)"
   doppler secrets set JWT_SECRET="$(grep JWT_SECRET .env | cut -d'=' -f2)"
   ```

2. **Update deployment scripts:**

   ```bash
   # Replace direct .env usage with secret management
   # Before: docker-compose up
   # After: doppler run -- docker-compose up
   ```

3. **Remove .env files from version control:**

   ```bash
   # Add to .gitignore
   echo ".env*" >> .gitignore

   # Remove from git
   git rm --cached .env
   git commit -m "Remove .env files from version control"
   ```

## Resources

- [Doppler Documentation](https://docs.doppler.com/)
- [1Password CLI Documentation](https://developer.1password.com/docs/cli/)
- [AWS SSM Parameter Store](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html)
- [HashiCorp Vault Documentation](https://www.vaultproject.io/docs)
- [OWASP Secret Management](https://owasp.org/www-project-cheat-sheets/cheatsheets/Secrets_Management_Cheat_Sheet.html)
