import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';
import { RedisService } from '../../../redis/redis.service';
import { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwtSecret') || '',
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: any) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      try {
        const isBlacklisted = await this.redisService.get(`blacklist:${token}`);
        if (isBlacklisted) {
          throw new UnauthorizedException('Token has been revoked');
        }
      } catch (err) {
        console.error(
          '[JwtStrategy] Redis connection error during token blacklist check:',
          err.message || err,
        );
      }
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || user.deletedAt || !user.isActive) {
      throw new UnauthorizedException('User not found or disabled/suspended');
    }

    // Remove sensitive data
    const { passwordHash, refreshToken, mfaSecret, ...result } = user;
    return result;
  }
}
