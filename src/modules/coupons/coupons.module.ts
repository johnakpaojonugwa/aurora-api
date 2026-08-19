import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { CouponsService } from './coupons.service';
import { AdminCouponsController } from './admin-coupons.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AdminCouponsController],
  providers: [CouponsService],
  exports: [CouponsService],
})
export class CouponsModule {}
