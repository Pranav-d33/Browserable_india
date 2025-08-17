import { S3Client, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { env, logger } from '@bharat-agents/shared';

// Create S3 client for MinIO
const s3Client = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: 'us-east-1', // MinIO doesn't use regions, but AWS SDK requires it
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  },
  forcePathStyle: true, // Required for MinIO
});

/**
 * Ensure bucket exists, create if it doesn't
 */
export const ensureBucket = async (bucketName: string): Promise<void> => {
  try {
    // Check if bucket exists
    await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
    logger.debug({ bucketName }, 'Bucket already exists');
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      // Bucket doesn't exist, create it
      try {
        await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
        logger.info({ bucketName }, 'Created bucket');
      } catch (createError) {
        logger.error({ bucketName, error: createError }, 'Failed to create bucket');
        throw createError;
      }
    } else {
      logger.error({ bucketName, error }, 'Failed to check bucket existence');
      throw error;
    }
  }
};

/**
 * Initialize default buckets
 */
export const initializeBuckets = async (): Promise<void> => {
  const defaultBuckets = ['artifacts', 'uploads', 'temp'];
  
  for (const bucket of defaultBuckets) {
    await ensureBucket(bucket);
  }
  
  logger.info({ buckets: defaultBuckets }, 'Initialized default buckets');
};

export { s3Client };
