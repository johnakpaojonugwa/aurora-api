import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService implements OnModuleInit {
  private resend: Resend | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const apiKey = this.configService.get<string>('resendApiKey');
    if (apiKey) {
      this.resend = new Resend(apiKey);
    }
  }

  async sendVerificationEmail(email: string, token: string) {
    console.log(`[Verification Email] Sent to: ${email}, Verification Token: ${token}`);

    if (!this.resend) {
      console.warn('Resend API key is not configured. Email send simulated.');
      return { success: true };
    }

    try {
      const { data, error } = await this.resend.emails.send({
        from: 'Aurora Boutique <noreply@auroraboutique.com>',
        to: [email],
        subject: 'Verify your Email Address - Aurora Boutique',
        html: `<p>Welcome to Aurora! Please verify your email by clicking the link below or using this token:</p><p><strong>${token}</strong></p>`,
      });

      if (error) {
        console.error('Error sending email via Resend:', error);
        return { success: false, error };
      }

      return { success: true, data };
    } catch (err) {
      console.error('Failed to send verification email via Resend:', err);
      return { success: false, error: err };
    }
  }
}
