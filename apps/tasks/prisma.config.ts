import { defineConfig } from 'prisma';

export default defineConfig({
  schema: './src/db/prisma/schema.prisma',
  seed: {
    exec: 'npx tsx src/db/seed.ts',
  },
});
