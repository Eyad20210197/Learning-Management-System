import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import argon2 from 'argon2';
import { PrismaClient } from '../libs/platform/src/database/generated/prisma/client';

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const main = async (): Promise<void> => {
  const email = required('OWNER_EMAIL').toLowerCase();
  const password = required('OWNER_PASSWORD');
  const firstName = required('OWNER_FIRST_NAME');
  const lastName = required('OWNER_LAST_NAME');
  if (password.length < 12 || password.length > 128)
    throw new Error('OWNER_PASSWORD must contain 12 to 128 characters');

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: required('DATABASE_URL') }),
  });

  try {
    const ownerRole = await prisma.role.findUnique({
      where: { name: 'OWNER' },
      select: { id: true },
    });
    if (ownerRole === null)
      throw new Error('OWNER role is missing; run npm run db:seed first');

    const existing = await prisma.user.findUnique({
      where: { email },
      include: { roles: { include: { role: true } } },
    });
    if (existing !== null) {
      if (!existing.roles.some(({ role }) => role.name === 'OWNER'))
        throw new Error(
          'The email already belongs to a non-owner account; refusing promotion',
        );
      console.log('Owner already exists; no changes made.');
    } else {
      const passwordHash = await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 19_456,
        timeCost: 2,
        parallelism: 1,
      });
      await prisma.user.create({
        data: {
          email,
          passwordHash,
          firstName,
          lastName,
          status: 'ACTIVE',
          emailVerifiedAt: new Date(),
          roles: { create: { roleId: ownerRole.id } },
        },
      });
      console.log('Owner created successfully.');
    }
  } finally {
    await prisma.$disconnect();
  }
};

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'Owner creation failed',
  );
  process.exitCode = 1;
});
