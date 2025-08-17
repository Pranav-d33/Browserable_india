import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { logger } from '@bharat-agents/shared';
import { env } from '../env.js';

export interface ArtifactMetadata {
  id: string;
  type: string;
  originalName: string;
  size: number;
  contentType: string;
  encrypted: boolean;
  encryptionMethod?: string;
  createdAt: Date;
}

export interface UploadResult {
  url: string;
  metadata: ArtifactMetadata;
}

export interface DownloadResult {
  data: Buffer;
  metadata: ArtifactMetadata;
}

/**
 * Data protection service for artifact encryption
 * TODO: Implement KMS-based encryption in Phase 3
 */
export class DataProtectionService {
  private s3Client: S3Client | null = null;
  private bucket: string;
  private enabled: boolean;

  constructor() {
    this.enabled = env.ENABLE_ARTIFACT_ENCRYPTION;
    this.bucket = env.MINIO_BUCKET || 'artifacts';
    
    if (this.enabled && env.MINIO_ENDPOINT) {
      this.s3Client = new S3Client({
        endpoint: env.MINIO_ENDPOINT,
        credentials: {
          accessKeyId: env.MINIO_ACCESS_KEY || '',
          secretAccessKey: env.MINIO_SECRET_KEY || '',
        },
        region: 'us-east-1', // MinIO default region
        forcePathStyle: true, // Required for MinIO
      });
      
      logger.info('Data protection service initialized with MinIO SSE-S3 encryption');
    } else {
      logger.info('Data protection service initialized without encryption (KMS planned for Phase 3)');
    }
  }

  /**
   * Upload artifact with encryption
   */
  async uploadArtifact(
    artifactId: string,
    data: Buffer,
    metadata: Omit<ArtifactMetadata, 'id' | 'encrypted' | 'encryptionMethod' | 'createdAt'>
  ): Promise<UploadResult> {
    if (!this.s3Client) {
      throw new Error('S3 client not configured. Set MINIO_ENDPOINT and related environment variables.');
    }

    const artifactMetadata: ArtifactMetadata = {
      ...metadata,
      id: artifactId,
      encrypted: this.enabled,
      encryptionMethod: this.enabled ? 'SSE-S3' : undefined,
      createdAt: new Date(),
    };

    const key = `artifacts/${artifactId}`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: metadata.contentType,
        Metadata: {
          'artifact-id': artifactId,
          'artifact-type': metadata.type,
          'original-name': metadata.originalName,
          'size': metadata.size.toString(),
          'encrypted': this.enabled.toString(),
          'encryption-method': this.enabled ? 'SSE-S3' : 'none',
          'created-at': artifactMetadata.createdAt.toISOString(),
        },
        // Enable server-side encryption with S3 managed keys
        ...(this.enabled && {
          ServerSideEncryption: 'AES256',
        }),
      });

      await this.s3Client.send(command);

      const url = `${env.MINIO_ENDPOINT}/${this.bucket}/${key}`;

      logger.info('Artifact uploaded with encryption', {
        artifactId,
        size: metadata.size,
        encrypted: this.enabled,
        method: this.enabled ? 'SSE-S3' : 'none',
      });

      return { url, metadata: artifactMetadata };
    } catch (error) {
      logger.error('Failed to upload artifact', { artifactId, error });
      throw error;
    }
  }

  /**
   * Download artifact with decryption
   */
  async downloadArtifact(artifactId: string): Promise<DownloadResult> {
    if (!this.s3Client) {
      throw new Error('S3 client not configured. Set MINIO_ENDPOINT and related environment variables.');
    }

    const key = `artifacts/${artifactId}`;

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      
      if (!response.Body) {
        throw new Error('No data received from S3');
      }

      const data = await response.Body.transformToByteArray();
      const buffer = Buffer.from(data);

      const metadata: ArtifactMetadata = {
        id: artifactId,
        type: response.Metadata?.['artifact-type'] || 'unknown',
        originalName: response.Metadata?.['original-name'] || 'unknown',
        size: parseInt(response.Metadata?.['size'] || '0'),
        contentType: response.ContentType || 'application/octet-stream',
        encrypted: response.Metadata?.['encrypted'] === 'true',
        encryptionMethod: response.Metadata?.['encryption-method'],
        createdAt: new Date(response.Metadata?.['created-at'] || Date.now()),
      };

      logger.info('Artifact downloaded', {
        artifactId,
        size: buffer.length,
        encrypted: metadata.encrypted,
        method: metadata.encryptionMethod,
      });

      return { data: buffer, metadata };
    } catch (error) {
      logger.error('Failed to download artifact', { artifactId, error });
      throw error;
    }
  }

  /**
   * Check if encryption is enabled
   */
  isEncryptionEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get encryption method
   */
  getEncryptionMethod(): string {
    if (!this.enabled) {
      return 'none';
    }
    return 'SSE-S3'; // Server-side encryption with S3 managed keys
  }

  /**
   * Get KMS encryption plan for Phase 3
   */
  getKMSPlan(): string {
    return `
Phase 3 KMS Encryption Plan:

1. AWS KMS Integration:
   - Use AWS KMS Customer Managed Keys (CMK) for encryption
   - Implement envelope encryption for large files
   - Store encrypted data keys with artifacts

2. Implementation Steps:
   - Create KMS key with appropriate permissions
   - Implement envelope encryption wrapper
   - Update upload/download methods to use KMS
   - Add key rotation policies

3. Security Benefits:
   - Customer-managed encryption keys
   - Automatic key rotation
   - Audit trails for key usage
   - Compliance with security standards

4. Environment Variables Needed:
   - AWS_KMS_KEY_ID: KMS key ARN
   - AWS_REGION: AWS region
   - AWS_ACCESS_KEY_ID: AWS access key
   - AWS_SECRET_ACCESS_KEY: AWS secret key

5. Migration Strategy:
   - Implement dual-write during transition
   - Re-encrypt existing artifacts
   - Update metadata to reflect new encryption method
    `;
  }
}

// Export singleton instance
export const dataProtectionService = new DataProtectionService();
