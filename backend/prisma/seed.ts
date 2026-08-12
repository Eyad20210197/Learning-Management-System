import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../libs/platform/src/database/generated/prisma/client';

const permissionDefinitions = [
  ['course.create', 'Create courses'],
  ['course.read', 'Read all courses'],
  ['course.update', 'Update course metadata'],
  ['course.publish', 'Publish courses'],
  ['course.archive', 'Archive courses'],
  ['curriculum.create', 'Create sections and lessons'],
  ['curriculum.update', 'Update sections and lessons'],
  ['curriculum.reorder', 'Reorder curriculum atomically'],
  ['enrollment.create', 'Grant course access'],
  ['enrollment.read', 'Read enrollment records'],
  ['enrollment.update', 'Update access windows and suspension'],
  ['enrollment.revoke', 'Revoke course access'],
  ['video.upload', 'Initiate and complete video uploads'],
  ['video.read', 'Read video processing state'],
  ['video.retry', 'Retry failed video processing'],
  ['video.activate', 'Activate ready lesson videos'],
  ['user.read', 'Read student operational data'],
  ['user.manage', 'Manage student account state'],
  ['audit.read', 'Read audit history'],
  ['security.read', 'Read security events'],
] as const;

const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl === undefined || databaseUrl.length === 0) {
  throw new Error('DATABASE_URL is required to seed the database');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

async function seed(): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    const ownerRole = await transaction.role.upsert({
      where: { name: 'OWNER' },
      create: {
        name: 'OWNER',
        description: 'The single LMS content and operations owner',
      },
      update: {
        description: 'The single LMS content and operations owner',
      },
    });

    await transaction.role.upsert({
      where: { name: 'STUDENT' },
      create: {
        name: 'STUDENT',
        description: 'A learner with access through active enrollments',
      },
      update: {
        description: 'A learner with access through active enrollments',
      },
    });

    const permissions = await Promise.all(
      permissionDefinitions.map(([key, description]) =>
        transaction.permission.upsert({
          where: { key },
          create: { key, description },
          update: { description },
          select: { id: true },
        }),
      ),
    );

    await transaction.rolePermission.createMany({
      data: permissions.map(({ id }) => ({
        roleId: ownerRole.id,
        permissionId: id,
      })),
      skipDuplicates: true,
    });
  });
}

void seed()
  .then(() => {
    process.stdout.write('Identity roles and permissions seeded.\n');
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
