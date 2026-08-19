import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { SuspendUserDto } from './dto/suspend-user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditLogInterceptor } from '../audit-logs/audit-logs.interceptor';
import { AuditLogAction } from '../audit-logs/audit-logs.decorator';
import { Role } from '@prisma/client';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@UseInterceptors(AuditLogInterceptor)
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll(
    @Query()
    query: {
      page?: number;
      limit?: number;
      role?: 'admin' | 'manager' | 'user';
      search?: string;
    },
  ) {
    return this.usersService.findAllAdminsAndManagers(query);
  }

  @Post()
  @AuditLogAction('ADMIN_USER_CREATED', 'users')
  async create(@Body() dto: CreateAdminUserDto) {
    return this.usersService.createAdminOrManager(dto);
  }

  @Put(':id/role')
  @AuditLogAction('ADMIN_USER_ROLE_UPDATED', 'users')
  async updateRole(
    @Param('id') id: string,
    @Body('role') role: Role,
  ) {
    return this.usersService.adminUpdateRole(id, role);
  }

  @Put(':id/suspend')
  @AuditLogAction('ADMIN_USER_SUSPENDED', 'users')
  async suspend(
    @Param('id') id: string,
    @Body() dto: SuspendUserDto,
  ) {
    return this.usersService.suspendUser(id, dto.reason);
  }

  @Put(':id/activate')
  @AuditLogAction('ADMIN_USER_ACTIVATED', 'users')
  async activate(@Param('id') id: string) {
    return this.usersService.activateUser(id);
  }

  @Get(':id/login-history')
  async getLoginHistory(@Param('id') id: string) {
    return this.usersService.getLoginHistory(id);
  }
}
