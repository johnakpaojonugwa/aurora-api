import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async updateRole(id: string, role: Role) {
    if (role === Role.admin) {
      throw new ForbiddenException('Cannot promote a user to admin role via the API');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { role },
    });

    // Sanitize user output
    const { passwordHash, refreshToken, mfaSecret, ...sanitized } = updatedUser;
    return sanitized;
  }
}
