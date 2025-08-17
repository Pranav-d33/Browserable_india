# Security Hardening Guide

This document outlines the comprehensive security measures implemented in Bharat Agents to ensure robust protection against various attack vectors.

## 🔒 Security Features Overview

### Browser App Security

#### 1. URL Validation and Private IP Blocking

- **RFC1918 Range Blocking**: Automatically blocks navigation to private IP ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
- **Localhost Protection**: Blocks localhost access unless explicitly allowed
- **Protocol Validation**: Only allows HTTP and HTTPS protocols
- **whatwg-url Integration**: Uses industry-standard URL parsing and validation

```typescript
// Environment variables
BLOCK_PRIVATE_ADDR = true; // Block private IP ranges
ALLOW_LOCALHOST = false; // Block localhost access
```

#### 2. Download Security

- **Download Blocking**: Intercepts and cancels file downloads by default
- **Same-Origin Protection**: Prevents same-origin downloads via blob: and data: URLs
- **Configurable Control**: Downloads can be enabled via `ALLOW_DOWNLOADS=true`

```typescript
// Download blocking implementation
page.on('download', download => {
  logger.warn('Download blocked', {
    sessionId,
    url: download.url(),
    suggestedFilename: download.suggestedFilename(),
  });
  download.cancel();
});
```

#### 3. JavaScript Evaluation Security

- **Script Validation**: Validates JavaScript code for unsafe patterns
- **Function Blocking**: Prevents function declarations and complex scripts
- **Configurable Control**: Can be enabled via `ALLOW_EVALUATE=true`

### Tasks App Security

#### 1. URL Validation

- **Protocol Enforcement**: Only HTTP and HTTPS URLs are allowed
- **whatwg-url Validation**: Industry-standard URL parsing
- **Sanitization**: Removes dangerous fragments and normalizes URLs

#### 2. Audit Log Redaction

- **Sensitive Data Protection**: Automatically redacts OTP, password, secret, and token values
- **Pattern Matching**: Uses regex patterns to identify sensitive information
- **Case-Insensitive**: Handles various naming conventions

```typescript
// Redaction patterns
const SECRET_PATTERNS = [
  /(otp|password|secret|token)["\s]*:["\s]*["'][^"']*["']/gi,
  /(api_key|access_key|private_key)["\s]*:["\s]*["'][^"']*["']/gi,
  /(auth_token|bearer_token|jwt_token)["\s]*:["\s]*["'][^"']*["']/gi,
];
```

#### 3. Row-Level Authorization

- **User Isolation**: Each run belongs to a specific user
- **Access Control**: Only owners and admins can access their runs
- **API Layer Enforcement**: Authorization checked at every endpoint

#### 4. Rate Limiting

- **Per-User Limits**: 120 requests per minute per user
- **Concurrent Run Limits**: Maximum 3 concurrent runs per user
- **Redis-Based**: Scalable rate limiting using Redis counters
- **Graceful Degradation**: Continues operation if Redis is unavailable

```typescript
// Rate limit configuration
USER_RATE_LIMIT_PER_MINUTE = 120;
USER_MAX_CONCURRENT_RUNS = 3;
```

#### 5. Data Protection

- **Artifact Encryption**: Server-side encryption (SSE-S3) for artifacts at rest
- **MinIO Integration**: Compatible with S3-compatible storage
- **KMS Planning**: Documented plan for AWS KMS integration in Phase 3

## 🚀 Scalability Features

### 1. Stateless Architecture

- **Session Store Abstraction**: In-memory sessions with Redis migration path
- **External Session Store**: TODO for Phase 3 Redis implementation
- **Load Balancer Ready**: Designed for horizontal scaling

### 2. Health and Readiness Endpoints

- **Health Checks**: `/health` endpoint for basic service health
- **Readiness Checks**: `/ready` endpoint for dependency verification
- **Kubernetes Compatible**: Ready for container orchestration

### 3. Pagination

- **Cursor-Based Pagination**: Efficient pagination for large datasets
- **Configurable Limits**: Default 20 items, maximum 100 per request
- **Metadata Included**: Total count, page info, and navigation helpers

### 4. OpenTelemetry Integration

- **Distributed Tracing**: Full request tracing across services
- **Metrics Export**: Prometheus-compatible metrics
- **OTLP Support**: Standard OpenTelemetry protocol
- **Auto-Instrumentation**: Automatic HTTP, Express, and database tracing

### 5. Container Security

- **Non-Root Execution**: All containers run as non-root user (nodejs:1001)
- **Read-Only Filesystem**: Write access limited to `/tmp` directories
- **Memory Limits**: Node.js memory capped at 512MB for development
- **Signal Handling**: Proper graceful shutdown with dumb-init

## 🔧 Configuration

### Environment Variables

#### Browser App

```bash
# Security
BLOCK_PRIVATE_ADDR=true
ALLOW_LOCALHOST=false
ALLOW_DOWNLOADS=false
ALLOW_EVALUATE=false

# Session Store
SESSION_STORE_TYPE=memory  # TODO: redis for Phase 3

# OpenTelemetry
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

#### Tasks App

```bash
# Rate Limiting
USER_RATE_LIMIT_PER_MINUTE=120
USER_MAX_CONCURRENT_RUNS=3

# Data Protection
ENABLE_ARTIFACT_ENCRYPTION=false
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

# OpenTelemetry
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

## 🛡️ Security Best Practices

### 1. Secret Management

- **Environment Variables**: Never commit secrets to version control
- **Secret Managers**: Use Doppler, 1Password, or AWS SSM
- **Rotation**: Regular secret rotation policies

### 2. Network Security

- **CORS Configuration**: Strict origin validation
- **HTTPS Only**: Enforce HTTPS in production
- **Private Network Blocking**: Prevent access to internal networks

### 3. Input Validation

- **Schema Validation**: Zod schemas for all inputs
- **URL Sanitization**: Clean and validate all URLs
- **Type Safety**: TypeScript for compile-time safety

### 4. Logging and Monitoring

- **Audit Logs**: Comprehensive audit trail
- **Sensitive Data Redaction**: Automatic redaction of secrets
- **Structured Logging**: JSON-formatted logs with correlation IDs

## 🔮 Future Enhancements (Phase 3)

### 1. Advanced Encryption

- **AWS KMS Integration**: Customer-managed encryption keys
- **Envelope Encryption**: For large file encryption
- **Key Rotation**: Automatic key rotation policies

### 2. External Session Store

- **Redis Sessions**: Distributed session storage
- **Session Replication**: High availability session management
- **Session Persistence**: Cross-restart session recovery

### 3. Advanced Rate Limiting

- **Dynamic Limits**: User-tier-based rate limits
- **Burst Protection**: Handle traffic spikes gracefully
- **Geographic Limits**: Region-based rate limiting

### 4. Enhanced Monitoring

- **Security Dashboards**: Real-time security monitoring
- **Anomaly Detection**: Automated threat detection
- **Compliance Reporting**: SOC2, GDPR compliance tools

## 🚨 Incident Response

### 1. Security Breach Response

1. **Immediate Isolation**: Disconnect affected services
2. **Log Analysis**: Review audit logs for suspicious activity
3. **Secret Rotation**: Rotate all potentially compromised secrets
4. **Forensic Analysis**: Preserve evidence for investigation
5. **Communication**: Notify stakeholders and users

### 2. Rate Limit Abuse

1. **Monitor Patterns**: Identify abuse patterns
2. **Temporary Blocks**: Block abusive IPs/users
3. **Investigation**: Determine root cause
4. **Policy Updates**: Adjust rate limits if needed

### 3. Data Breach Response

1. **Data Assessment**: Identify affected data
2. **Encryption Status**: Verify encryption status
3. **Legal Compliance**: Follow data breach notification laws
4. **User Notification**: Notify affected users
5. **Security Review**: Conduct post-incident review

## 📋 Compliance

### 1. Data Protection

- **Encryption at Rest**: All sensitive data encrypted
- **Encryption in Transit**: TLS for all communications
- **Access Controls**: Role-based access control (RBAC)

### 2. Audit Requirements

- **Comprehensive Logging**: All actions logged with context
- **Data Retention**: Configurable log retention policies
- **Audit Trail**: Immutable audit trail for compliance

### 3. Privacy

- **Data Minimization**: Only collect necessary data
- **User Consent**: Clear consent mechanisms
- **Data Portability**: User data export capabilities

## 🔍 Security Testing

### 1. Automated Testing

- **URL Validation Tests**: Comprehensive URL security tests
- **Rate Limit Tests**: Verify rate limiting effectiveness
- **Encryption Tests**: Validate encryption implementation

### 2. Penetration Testing

- **Regular Assessments**: Quarterly security assessments
- **Vulnerability Scanning**: Automated vulnerability detection
- **Code Reviews**: Security-focused code reviews

### 3. Compliance Audits

- **SOC2 Preparation**: Security controls assessment
- **GDPR Compliance**: Data protection regulation compliance
- **Industry Standards**: ISO 27001 alignment

## 📞 Security Contacts

For security issues or questions:

- **Security Team**: security@bharat-agents.com
- **Bug Reports**: security-reports@bharat-agents.com
- **Emergency**: +1-XXX-XXX-XXXX

---

**Last Updated**: December 2024
**Version**: 1.0.0
**Next Review**: March 2025
