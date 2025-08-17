import fs from 'fs/promises';
import path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { logger } from '@bharat-agents/shared';

// =============================================================================
// Local File Storage Service
// =============================================================================

export class LocalFileStorage {
  private uploadDir: string;
  private publicDir: string;
  private privateDir: string;

  constructor(baseDir: string = 'uploads') {
    this.uploadDir = path.resolve(process.cwd(), baseDir);
    this.publicDir = path.join(this.uploadDir, 'public');
    this.privateDir = path.join(this.uploadDir, 'private');
    
    this.ensureDirectories();
  }

  private async ensureDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
      await fs.mkdir(this.publicDir, { recursive: true });
      await fs.mkdir(this.privateDir, { recursive: true });
      logger.info({ uploadDir: this.uploadDir }, 'Local file storage directories ensured');
    } catch (error) {
      logger.error({ error }, 'Failed to create upload directories');
      throw error;
    }
  }

  private sanitizeFilename(filename: string): string {
    // Remove or replace dangerous characters
    return filename
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\.\./g, '_')
      .replace(/^\./, '_')
      .replace(/\.$/, '_');
  }

  private generateUniqueFilename(originalName: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const ext = path.extname(originalName);
    const name = path.basename(originalName, ext);
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
    const { isPublic = false, contentType, metadata } = options;
    
    // Sanitize and generate unique filename
    const sanitizedFilename = this.sanitizeFilename(filename);
    const uniqueFilename = this.generateUniqueFilename(sanitizedFilename);
    
    // Determine storage directory
    const storageDir = isPublic ? this.publicDir : this.privateDir;
    const filePath = path.join(storageDir, uniqueFilename);
    
    try {
      // Write file
      if (Buffer.isBuffer(data)) {
        await fs.writeFile(filePath, data);
      } else {
        await fs.writeFile(filePath, data, 'utf8');
      }

      // Save metadata if provided
      if (metadata) {
        const metadataPath = `${filePath}.meta.json`;
        await fs.writeFile(metadataPath, JSON.stringify({
          originalName: filename,
          contentType,
          metadata,
          uploadedAt: new Date().toISOString(),
        }, null, 2));
      }

      const url = isPublic 
        ? `/uploads/public/${uniqueFilename}`
        : `/uploads/private/${uniqueFilename}`;

      logger.debug({
        originalName: filename,
        filename: uniqueFilename,
        path: filePath,
        url,
        size: Buffer.isBuffer(data) ? data.length : data.length,
        isPublic,
      }, 'File saved successfully');

      return {
        url,
        path: filePath,
        filename: uniqueFilename,
      };

    } catch (error) {
      logger.error({
        filename: uniqueFilename,
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to save file');
      throw error;
    }
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
    const { isPublic = false, contentType, metadata } = options;
    
    // Sanitize and generate unique filename
    const sanitizedFilename = this.sanitizeFilename(filename);
    const uniqueFilename = this.generateUniqueFilename(sanitizedFilename);
    
    // Determine storage directory
    const storageDir = isPublic ? this.publicDir : this.privateDir;
    const filePath = path.join(storageDir, uniqueFilename);
    
    try {
      // Create write stream
      const writeStream = createWriteStream(filePath);
      
      // Pipe the data
      await pipeline(stream, writeStream);

      // Save metadata if provided
      if (metadata) {
        const metadataPath = `${filePath}.meta.json`;
        await fs.writeFile(metadataPath, JSON.stringify({
          originalName: filename,
          contentType,
          metadata,
          uploadedAt: new Date().toISOString(),
        }, null, 2));
      }

      const url = isPublic 
        ? `/uploads/public/${uniqueFilename}`
        : `/uploads/private/${uniqueFilename}`;

      logger.debug({
        originalName: filename,
        filename: uniqueFilename,
        path: filePath,
        url,
        isPublic,
      }, 'File saved from stream successfully');

      return {
        url,
        path: filePath,
        filename: uniqueFilename,
      };

    } catch (error) {
      logger.error({
        filename: uniqueFilename,
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to save file from stream');
      throw error;
    }
  }

  async getFile(filename: string, isPublic: boolean = false): Promise<Buffer> {
    const storageDir = isPublic ? this.publicDir : this.privateDir;
    const filePath = path.join(storageDir, this.sanitizeFilename(filename));
    
    try {
      const data = await fs.readFile(filePath);
      logger.debug({ filename, path: filePath }, 'File retrieved successfully');
      return data;
    } catch (error) {
      logger.error({
        filename,
        path: filePath,
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to retrieve file');
      throw error;
    }
  }

  async getFileStream(filename: string, isPublic: boolean = false): Promise<NodeJS.ReadableStream> {
    const storageDir = isPublic ? this.publicDir : this.privateDir;
    const filePath = path.join(storageDir, this.sanitizeFilename(filename));
    
    try {
      const stream = createReadStream(filePath);
      logger.debug({ filename, path: filePath }, 'File stream created successfully');
      return stream;
    } catch (error) {
      logger.error({
        filename,
        path: filePath,
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to create file stream');
      throw error;
    }
  }

  async deleteFile(filename: string, isPublic: boolean = false): Promise<void> {
    const storageDir = isPublic ? this.publicDir : this.privateDir;
    const filePath = path.join(storageDir, this.sanitizeFilename(filename));
    const metadataPath = `${filePath}.meta.json`;
    
    try {
      // Delete main file
      await fs.unlink(filePath);
      
      // Delete metadata file if it exists
      try {
        await fs.unlink(metadataPath);
      } catch {
        // Metadata file doesn't exist, ignore
      }
      
      logger.debug({ filename, path: filePath }, 'File deleted successfully');
    } catch (error) {
      logger.error({
        filename,
        path: filePath,
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to delete file');
      throw error;
    }
  }

  async fileExists(filename: string, isPublic: boolean = false): Promise<boolean> {
    const storageDir = isPublic ? this.publicDir : this.privateDir;
    const filePath = path.join(storageDir, this.sanitizeFilename(filename));
    
    try {
      await fs.access(filePath);
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
    const storageDir = isPublic ? this.publicDir : this.privateDir;
    const filePath = path.join(storageDir, this.sanitizeFilename(filename));
    const metadataPath = `${filePath}.meta.json`;
    
    try {
      const stats = await fs.stat(filePath);
      let metadata: Record<string, any> | undefined;
      
      // Try to read metadata
      try {
        const metadataContent = await fs.readFile(metadataPath, 'utf8');
        metadata = JSON.parse(metadataContent);
      } catch {
        // Metadata file doesn't exist, ignore
      }
      
      return {
        size: stats.size,
        lastModified: stats.mtime,
        contentType: metadata?.contentType,
        metadata: metadata?.metadata,
      };
    } catch (error) {
      logger.error({
        filename,
        path: filePath,
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to get file info');
      return null;
    }
  }

  async listFiles(isPublic: boolean = false, pattern?: string): Promise<string[]> {
    const storageDir = isPublic ? this.publicDir : this.privateDir;
    
    try {
      const files = await fs.readdir(storageDir);
      
      // Filter out metadata files and apply pattern if provided
      const filteredFiles = files.filter(file => {
        if (file.endsWith('.meta.json')) return false;
        if (pattern) {
          const regex = new RegExp(pattern);
          return regex.test(file);
        }
        return true;
      });
      
      return filteredFiles;
    } catch (error) {
      logger.error({
        storageDir,
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to list files');
      return [];
    }
  }

  // Health check
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; error?: string }> {
    try {
      await this.ensureDirectories();
      return { status: 'healthy' };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

// Export singleton instance
export const localFileStorage = new LocalFileStorage();
