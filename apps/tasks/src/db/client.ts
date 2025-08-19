import { PrismaClient } from '@prisma/client';
import { logger } from '@bharat-agents/shared';

// Create Prisma client with logging
const prisma = new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    },
    {
      emit: 'event',
      level: 'error',
    },
    {
      emit: 'event',
      level: 'info',
    },
    {
      emit: 'event',
      level: 'warn',
    },
  ],
});

// Log queries in development
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query', e => {
    logger.debug(
      {
        query: e.query,
        params: e.params,
        duration: `${e.duration}ms`,
      },
      'Database query'
    );
  });
}

// Log errors
prisma.$on('error', e => {
  logger.error(
    {
      error: e.message,
      target: e.target,
    },
    'Database error'
  );
});

// Log info
prisma.$on('info', e => {
  logger.info(
    {
      message: e.message,
      target: e.target,
    },
    'Database info'
  );
});

// Log warnings
prisma.$on('warn', e => {
  logger.warn(
    {
      message: e.message,
      target: e.target,
    },
    'Database warning'
  );
});

export { prisma as db };
