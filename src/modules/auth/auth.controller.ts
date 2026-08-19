import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { VerifyMfaDto } from './dto/verify-mfa.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { GetUser } from '../../common/decorators/user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('verify-mfa')
  async verifyMfa(@Body() dto: VerifyMfaDto) {
    return this.authService.verifyMfa(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(@GetUser('id') userId: string) {
    return this.authService.logout(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('mfa/setup')
  async setupMfa(@GetUser('id') userId: string) {
    return this.authService.setupMfa(userId);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('mfa/enable')
  async enableMfa(@GetUser('id') userId: string, @Body('token') token: string) {
    if (!token) {
      throw new BadRequestException('MFA token is required');
    }
    return this.authService.enableMfa(userId, token);
  }
}
