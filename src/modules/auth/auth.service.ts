import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { EmailService } from '../email/email.service';
import * as bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { VerifyMfaDto } from './dto/verify-mfa.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private redisService: RedisService,
    private emailService: EmailService,
    private auditLogsService: AuditLogsService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    if (user && !user.deletedAt && user.isActive) {
      const isValid = await bcrypt.compare(pass, user.passwordHash);
      if (isValid) {
        return this.sanitizeUser(user);
      }
    }
    return null;
  }

  async register(dto: RegisterDto) {
    // Check if user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, 12);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: 'user',
      },
    });

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email, user.role);

    // Send verification email
    await this.emailService.sendVerificationEmail(
      user.email,
      tokens.accessToken,
    );

    return {
      user: this.sanitizeUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async login(dto: LoginDto, ip?: string, userAgent?: string) {
    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is deleted or suspended
    if (user.deletedAt || !user.isActive) {
      throw new UnauthorizedException('Account disabled or suspended');
    }

    // Verify password
    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check MFA
    if (user.mfaEnabled) {
      return {
        mfaRequired: true,
        userId: user.id,
      };
    }

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email, user.role);

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Write audit log
    await this.auditLogsService.log(
      user.id,
      'USER_LOGIN',
      'auth',
      { method: 'POST', url: '/api/v1/auth/login' },
      ip || 'unknown',
      userAgent || 'unknown',
    );

    return {
      mfaRequired: false,
      user: this.sanitizeUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async verifyMfa(dto: VerifyMfaDto, ip?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });

    if (!user || !user.mfaSecret) {
      throw new BadRequestException('MFA not configured');
    }

    // Check if user is deleted or suspended
    if (user.deletedAt || !user.isActive) {
      throw new UnauthorizedException('Account disabled or suspended');
    }

    // Verify TOTP
    const verified = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: dto.token,
      window: 2,
    });

    if (!verified) {
      throw new BadRequestException('Invalid MFA token');
    }

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email, user.role);

    // Write audit log
    await this.auditLogsService.log(
      user.id,
      'USER_LOGIN_MFA',
      'auth',
      { method: 'POST', url: '/api/v1/auth/verify-mfa' },
      ip || 'unknown',
      userAgent || 'unknown',
    );

    return {
      user: this.sanitizeUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async refresh(dto: RefreshTokenDto) {
    try {
      const payload = this.jwtService.verify(dto.refreshToken, {
        secret: this.configService.get<string>('jwtRefreshSecret'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || user.deletedAt || !user.isActive) {
        throw new UnauthorizedException('User not found or disabled/suspended');
      }

      // Check if refresh token matches
      if (!user.refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const isTokenMatching = await bcrypt.compare(
        dto.refreshToken,
        user.refreshToken,
      );
      if (!isTokenMatching) {
        // Token theft detected - invalidate all sessions
        await this.invalidateAllSessions(user.id);
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user.id, user.email, user.role);

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async verifyEmail(token: string) {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('jwtSecret'),
      });

      const userId = payload.sub;
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.isEmailVerified) {
        return { success: true, message: 'Email is already verified' };
      }

      await this.prisma.user.update({
        where: { id: userId },
        data: { isEmailVerified: true },
      });

      return { success: true, message: 'Email verified successfully' };
    } catch (error) {
      throw new BadRequestException('Invalid or expired verification token');
    }
  }

  async logout(userId: string, token?: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });

    if (token) {
      try {
        const decoded = this.jwtService.decode(token);
        if (decoded && decoded.exp) {
          const now = Math.floor(Date.now() / 1000);
          const remainingSeconds = decoded.exp - now;
          if (remainingSeconds > 0) {
            await this.redisService.setex(
              `blacklist:${token}`,
              remainingSeconds,
              'true',
            );
          }
        }
      } catch (error) {
        // Ignore decoding error
      }
    }

    return { success: true };
  }

  async setupMfa(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const secret = speakeasy.generateSecret({
      length: 20,
      name: `Aurora: ${user.email}`,
      issuer: 'Aurora Boutique',
    });

    // Store secret temporarily in Redis
    await this.redisService.setex(
      `mfa_setup:${userId}`,
      300, // 5 minutes
      secret.base32,
    );

    // Generate QR code
    const qrCode = await QRCode.toDataURL(secret.otpauth_url || '');

    return {
      secret: secret.base32,
      qrCode,
    };
  }

  async enableMfa(userId: string, token: string) {
    const secret = await this.redisService.get(`mfa_setup:${userId}`);
    if (!secret) {
      throw new BadRequestException('MFA setup expired');
    }

    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2,
    });

    if (!verified) {
      throw new BadRequestException('Invalid token');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaSecret: secret,
        mfaEnabled: true,
      },
    });

    await this.redisService.del(`mfa_setup:${userId}`);

    return { success: true };
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const accessToken = this.jwtService.sign({
      sub: userId,
      email,
      role,
    });

    const refreshToken = this.jwtService.sign(
      {
        sub: userId,
        email,
        role,
      },
      {
        secret: this.configService.get<string>('jwtRefreshSecret'),
        expiresIn: this.configService.get<string>(
          'jwtRefreshExpiration',
          '7d',
        ) as any,
      },
    );

    // Hash the refresh token before storing it in the database
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 12);

    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: hashedRefreshToken },
    });

    return { accessToken, refreshToken };
  }

  private async invalidateAllSessions(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }

  private sanitizeUser(user: any) {
    const { passwordHash, refreshToken, mfaSecret, ...sanitized } = user;
    return sanitized;
  }
}
