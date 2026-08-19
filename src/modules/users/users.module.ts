import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AdminUsersController } from './admin-users.controller';
import { AdminCustomersController } from './admin-customers.controller';
import { PrismaModule } from '../../database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [UsersController, AdminUsersController, AdminCustomersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
