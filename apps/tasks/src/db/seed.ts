import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create a dev user
  const devUser = await prisma.user.upsert({
    where: { email: 'dev@bharat-agents.com' },
    update: {},
    create: {
      email: 'dev@bharat-agents.com',
      role: 'ADMIN',
    },
  });

  console.log('✅ Created dev user:', devUser.email);

  // Create some sample runs for testing
  const sampleRuns = await Promise.all([
    prisma.run.create({
      data: {
        userId: devUser.id,
        agent: 'echo',
        status: 'COMPLETED',
        input: 'Hello, Bharat!',
        output: 'Hello, Bharat!',
        meta: {
          source: 'seed',
          tags: ['sample', 'echo'],
        },
      },
    }),
    prisma.run.create({
      data: {
        userId: devUser.id,
        agent: 'echo',
        status: 'COMPLETED',
        input: 'Namaste India',
        output: 'Namaste India',
        meta: {
          source: 'seed',
          tags: ['sample', 'echo'],
        },
      },
    }),
  ]);

  console.log('✅ Created sample runs:', sampleRuns.length);

  console.log('🎉 Database seed completed successfully!');
}

main()
  .catch(e => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
