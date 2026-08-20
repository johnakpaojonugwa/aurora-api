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
import { SuspendUserDto } from './dto/suspend-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditLogInterceptor } from '../audit-logs/audit-logs.interceptor';
import { AuditLogAction } from '../audit-logs/audit-logs.decorator';

@Controller('admin/customers')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AuditLogInterceptor)
export class AdminCustomersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('admin', 'manager')
  async findAll(
    @Query()
    query: {
      page?: number;
      limit?: number;
      search?: string;
      startDate?: string;
      endDate?: string;
      sortBy?: 'createdAt' | 'totalSpent' | 'orderCount';
      sortOrder?: 'asc' | 'desc';
    },
  ) {
    return this.usersService.findAllCustomers(query);
  }

  @Get(':id')
  @Roles('admin', 'manager')
  async findOne(@Param('id') id: string) {
    return this.usersService.findCustomerDetails(id);
  }

  @Put(':id/suspend')
  @Roles('admin')
  @AuditLogAction('CUSTOMER_SUSPENDED', 'users')
  async suspend(@Param('id') id: string, @Body() dto: SuspendUserDto) {
    return this.usersService.suspendUser(id, dto.reason);
  }

  @Put(':id/unsuspend')
  @Roles('admin')
  @AuditLogAction('CUSTOMER_UNSUSPENDED', 'users')
  async unsuspend(@Param('id') id: string) {
    return this.usersService.activateUser(id);
  }

  @Post(':id/reset-password')
  @Roles('admin')
  @AuditLogAction('CUSTOMER_PASSWORD_RESET', 'users')
  async resetPassword(@Param('id') id: string, @Body() dto: ResetPasswordDto) {
    const sendMail = dto.sendEmail !== undefined ? dto.sendEmail : true;
    return this.usersService.resetCustomerPassword(id, sendMail);
  }

  /**
   * Updates internal staff/admin annotation notes on a customer's profile.
   * 
   * @param id Database ID of the target customer account.
   * @param body Payload containing the updated annotation text.
   */
  @Put(':id/notes')
  @Roles('admin', 'manager')
  @AuditLogAction('CUSTOMER_NOTES_UPDATED', 'users')
  async updateNotes(@Param('id') id: string, @Body() body: { notes: string }) {
    return this.usersService.updateCustomerNotes(id, body.notes);
  }
}
