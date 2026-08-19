import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class RefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          return req?.body?.refreshToken || req?.headers?.authorization?.replace('Bearer ', '');
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwtRefreshSecret', 'superrefreshsecretkeychangeinproduction'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: any) {
    const refreshToken = req?.body?.refreshToken || req?.headers?.authorization?.replace('Bearer ', '');
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      refreshToken,
    };
  }
}
