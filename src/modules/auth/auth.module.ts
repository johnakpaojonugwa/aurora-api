import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PrismaModule } from '../../database/prisma.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    PassportModule,
    PrismaModule,
    EmailModule,
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>(
          'jwtSecret',
          'supersecretkeychangeinproduction',
        ),
        signOptions: {
          expiresIn: configService.get<string>(
            'jwtAccessExpiration',
            '15m',
          ) as any,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
