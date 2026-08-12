import { Injectable } from '@nestjs/common';
import { PrismaService } from '@lms/platform';
import type { CreateStudentInput, UserRepositoryPort } from '../../application';
import { Email, EmailAlreadyRegisteredError, User } from '../../domain';

@Injectable()
export class PrismaUserRepository implements UserRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async existsByEmail(email: Email): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.value },
      select: { id: true },
    });

    return user !== null;
  }

  async createStudent(input: CreateStudentInput): Promise<User> {
    try {
      const record = await this.prisma.$transaction(async (transaction) => {
        const studentRole = await transaction.role.findUnique({
          where: { name: 'STUDENT' },
          select: { id: true },
        });

        if (studentRole === null) {
          throw new Error('STUDENT role is not seeded');
        }

        return transaction.user.create({
          data: {
            email: input.email.value,
            passwordHash: input.passwordHash,
            firstName: input.firstName,
            lastName: input.lastName,
            status: 'ACTIVE',
            roles: { create: { roleId: studentRole.id } },
          },
          include: { roles: { include: { role: true } } },
        });
      });

      return new User({
        id: record.id,
        email: Email.create(record.email),
        firstName: record.firstName,
        lastName: record.lastName,
        status: record.status,
        roles: record.roles.map(({ role }) => role.name),
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      });
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        throw new EmailAlreadyRegisteredError();
      }

      throw error;
    }
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}
