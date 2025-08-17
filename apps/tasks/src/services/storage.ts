import { env } from '../env';
import { logger } from '@bharat-agents/shared';
import { localFileStorage } from './fileStorage';
import { s3Client, ensureBucket, initializeBuckets } from './s3';

// =============================================================================
// Storage Service Interface
// =============================================================================

export interface StorageService {
  saveFile(
    filename: string,
    data: Buffer | string,
    options?: {
      isPublic?: boolean;
      contentType?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<{ url: string; path: string; filename: string }>;
  
  saveFileFromStream(
    filename: string,
    stream: NodeJS.ReadableStream,
    options?: {
      isPublic?: boolean;
      contentType?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<{ url: string; path: string; filename: string }>;
  
  getFile(filename: string, isPublic?: boolean): Promise<Buffer>;
  
  getFileStream(filename: string, isPublic?: boolean): Promise<NodeJS.ReadableStream>;
  
  deleteFile(filename: string, isPublic?: boolean): Promise<void>;
  
  fileExists(filename: string, isPublic?: boolean): Promise<boolean>;
  
  getFileInfo(filename: string, isPublic?: boolean): Promise<{
    size: number;
    lastModified: Date;
    contentType?: string;
    metadata?: Record<string, any>;
  } | null>;
  
  listFiles(isPublic?: boolean, pattern?: string): Promise<string[]>;
  
  healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; error?: string }>;
}

// =============================================================================
// S3 Storage Service Adapter
// =============================================================================

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

class S3StorageService implements StorageService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    this.s3Client = s3Client;
    this.bucketName = env.MINIO_BUCKET || 'artifacts';
  }

  private sanitizeFilename(filename: string): string {
    return filename.replace(/[<>:"/\\|?*]/g, '_');
  }

  private generateUniqueFilename(originalName: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const ext = originalName.includes('.') ? originalName.substring(originalName.lastIndexOf('.')) : '';
    const name = originalName.includes('.') ? originalName.substring(0, originalName.lastIndexOf('.')) : originalName;
    const sanitizedName = this.sanitizeFilename(name);
    
    return `${sanitizedName}_${timestamp}_${random}${ext}`;
  }

  async saveFile(
    filename: string,
    data: Buffer | string,
    options: {
      isPublic?: boolean;
      contentType?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<{ url: string; path: string; filename: string }> {
    const { contentType, metadata } = options;
    
    const sanitizedFilename = this.sanitizeFilename(filename);
    const uniqueFilename = this.generateUniqueFilename(sanitizedFilename);
    
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: uniqueFilename,
      Body: Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8'),
      ContentType: contentType || 'application/octet-stream',
      Metadata: metadata,
    });

    await this.s3Client.send(command);

    const url = `${env.S3_ENDPOINT}/${this.bucketName}/${uniqueFilename}`;

    logger.debug({
      originalName: filename,
      filename: uniqueFilename,
      url,
      size: Buffer.isBuffer(data) ? data.length : data.length,
    }, 'File saved to S3 successfully');

    return {
      url,
      path: uniqueFilename,
      filename: uniqueFilename,
    };
  }

  async saveFileFromStream(
    filename: string,
    stream: NodeJS.ReadableStream,
    options: {
      isPublic?: boolean;
      contentType?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<{ url: string; path: string; filename: string }> {
    const { contentType, metadata } = options;
    
    const sanitizedFilename = this.sanitizeFilename(filename);
    const uniqueFilename = this.generateUniqueFilename(sanitizedFilename);
    
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: uniqueFilename,
      Body: stream,
      ContentType: contentType || 'application/octet-stream',
      Metadata: metadata,
    });

    await this.s3Client.send(command);

    const url = `${env.S3_ENDPOINT}/${this.bucketName}/${uniqueFilename}`;

    logger.debug({
      originalName: filename,
      filename: uniqueFilename,
      url,
    }, 'File saved to S3 from stream successfully');

    return {
      url,
      path: uniqueFilename,
      filename: uniqueFilename,
    };
  }

  async getFile(filename: string, isPublic: boolean = false): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: this.sanitizeFilename(filename),
    });

    const response = await this.s3Client.send(command);
    
    if (!response.Body) {
      throw new Error('File not found or empty');
    }

    const chunks: Buffer[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }

  async getFileStream(filename: string, isPublic: boolean = false): Promise<NodeJS.ReadableStream> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: this.sanitizeFilename(filename),
    });

    const response = await this.s3Client.send(command);
    
    if (!response.Body) {
      throw new Error('File not found or empty');
    }

    return response.Body as NodeJS.ReadableStream;
  }

  async deleteFile(filename: string, isPublic: boolean = false): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: this.sanitizeFilename(filename),
    });

    await this.s3Client.send(command);
    
    logger.debug({ filename }, 'File deleted from S3 successfully');
  }

  async fileExists(filename: string, isPublic: boolean = false): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: this.sanitizeFilename(filename),
      });

      await this.s3Client.send(command);
      return true;
    } catch {
      return false;
    }
  }

  async getFileInfo(filename: string, isPublic: boolean = false): Promise<{
    size: number;
    lastModified: Date;
    contentType?: string;
    metadata?: Record<string, any>;
  } | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: this.sanitizeFilename(filename),
      });

      const response = await this.s3Client.send(command);
      
      return {
        size: response.ContentLength || 0,
        lastModified: response.LastModified || new Date(),
        contentType: response.ContentType,
        metadata: response.Metadata,
      };
    } catch (error) {
      logger.error({
        filename,
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to get file info from S3');
      return null;
    }
  }

  async listFiles(isPublic: boolean = false, pattern?: string): Promise<string[]> {
    const command = new ListObjectsV2Command({
      Bucket: this.bucketName,
      MaxKeys: 1000,
    });

    const response = await this.s3Client.send(command);
    
    if (!response.Contents) {
      return [];
    }

    let files = response.Contents.map(obj => obj.Key || '').filter(key => key.length > 0);
    
    if (pattern) {
      const regex = new RegExp(pattern);
      files = files.filter(file => regex.test(file));
    }
    
    return files;
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; error?: string }> {
    try {
      await ensureBucket(this.bucketName);
      return { status: 'healthy' };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

// =============================================================================
// Storage Service Factory
// =============================================================================

class StorageServiceFactory {
  private static instance: StorageService | null = null;

  static getInstance(): StorageService {
    if (!this.instance) {
      if (env.USE_LOCAL_STORAGE) {
        logger.info('Using local file storage service');
        this.instance = localFileStorage;
      } else {
        logger.info('Using S3 storage service');
        this.instance = new S3StorageService();
      }
    }
    
    return this.instance!;
  }

  static async initialize(): Promise<void> {
    const service = this.getInstance();
    
    // Test the service
    const health = await service.healthCheck();
    if (health.status === 'unhealthy') {
      throw new Error(`Storage service health check failed: ${health.error}`);
    }
    
    // Initialize buckets if using S3
    if (!env.USE_LOCAL_STORAGE) {
      await initializeBuckets();
    }
    
    logger.info('Storage service initialized successfully');
  }
}

// Export the factory and convenience function
export { StorageServiceFactory };
export const getStorage = () => StorageServiceFactory.getInstance();
