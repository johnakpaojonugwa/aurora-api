import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { GenerateCouponsDto } from './dto/generate-coupons.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditLogInterceptor } from '../audit-logs/audit-logs.interceptor';
import { AuditLogAction } from '../audit-logs/audit-logs.decorator';

@Controller('admin/coupons')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@UseInterceptors(AuditLogInterceptor)
export class AdminCouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Get()
  async findAll(
    @Query()
    query: {
      page?: number;
      limit?: number;
      isActive?: boolean;
      search?: string;
    },
  ) {
    return this.couponsService.findAll(query);
  }

  @Post()
  @AuditLogAction('COUPON_CREATED', 'coupons')
  async create(@Body() dto: CreateCouponDto) {
    return this.couponsService.create(dto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.couponsService.findOne(id);
  }

  @Put(':id')
  @AuditLogAction('COUPON_UPDATED', 'coupons')
  async update(@Param('id') id: string, @Body() dto: UpdateCouponDto) {
    return this.couponsService.update(id, dto);
  }

  @Delete(':id')
  @AuditLogAction('COUPON_DELETED', 'coupons')
  async delete(@Param('id') id: string) {
    return this.couponsService.delete(id);
  }

  @Post('generate')
  @AuditLogAction('COUPON_GENERATED', 'coupons')
  async generate(@Body() dto: GenerateCouponsDto) {
    return this.couponsService.generate(dto);
  }
}
