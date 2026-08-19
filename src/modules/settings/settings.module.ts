import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { SettingsService } from './settings.service';
import { AdminSettingsController } from './admin-settings.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AdminSettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
