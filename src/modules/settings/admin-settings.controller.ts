import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { UpdateTaxDto } from './dto/update-tax.dto';
import { UpdateShippingDto } from './dto/update-shipping.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditLogInterceptor } from '../audit-logs/audit-logs.interceptor';
import { AuditLogAction } from '../audit-logs/audit-logs.decorator';

@Controller('admin/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@UseInterceptors(AuditLogInterceptor)
export class AdminSettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getSettings() {
    return this.settingsService.getSettings();
  }

  @Put()
  @AuditLogAction('SETTINGS_UPDATED', 'settings')
  async updateSettings(@Body() dto: UpdateSettingsDto) {
    return this.settingsService.updateSettings(dto);
  }

  @Get('tax')
  async getTaxSettings() {
    return this.settingsService.getTaxSettings();
  }

  @Put('tax')
  @AuditLogAction('TAX_SETTINGS_UPDATED', 'settings')
  async updateTaxSettings(@Body() dto: UpdateTaxDto) {
    return this.settingsService.updateTaxSettings(dto);
  }

  @Get('shipping')
  async getShippingSettings() {
    return this.settingsService.getShippingSettings();
  }

  @Put('shipping')
  @AuditLogAction('SHIPPING_SETTINGS_UPDATED', 'settings')
  async updateShippingSettings(@Body() dto: UpdateShippingDto) {
    return this.settingsService.updateShippingSettings(dto);
  }
}
