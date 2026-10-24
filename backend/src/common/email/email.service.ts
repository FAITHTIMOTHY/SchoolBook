import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { toASCII } from 'punycode';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly configService: ConfigService) {
    this.initTransporter();
  }

  private initTransporter() {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<string>('SMTP_PORT');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    if (host && port && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: parseInt(port, 10),
        secure: this.configService.get<string>('SMTP_SECURE') === 'true',
        auth: {
          user,
          pass,
        },
      });
    } else {
      // Fallback to ethereal for dev if not configured
      this.transporter = null;
    }
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '***';
    const maskedLocal = local.length <= 2 ? '***' : local[0] + '***' + local[local.length - 1];
    return `${maskedLocal}@${toASCII(domain.toLowerCase())}`;
  }

  private normalizeEmailForHeader(email: string): string {
    const trimmed = email.trim();
    const [local, domain] = trimmed.split('@');
    if (!domain) return trimmed;
    return `${local}@${toASCII(domain.toLowerCase())}`;
  }

  private async sendMail(to: string, subject: string, text: string, html?: string) {
    const from = this.configService.get<string>('MAIL_FROM') || 'no-reply@schoolbook.local';
    const toNormalized = this.normalizeEmailForHeader(to);
    const masked = this.maskEmail(toNormalized);

    if (!this.transporter) {
      this.logger.debug(`Email not sent (no transporter). To: ${masked}, Subject: ${subject}`);
      return;
    }

    try {
      await this.transporter.sendMail({
        from,
        to: toNormalized,
        subject,
        text,
        html,
      });
      this.logger.debug(`Email sent. To: ${masked}, Subject: ${subject}`);
    } catch (error) {
      this.logger.error(`Failed to send email. To: ${masked}, Subject: ${subject}`);
      throw error;
    }
  }

  async sendPasswordResetEmail(email: string, tenantSlug: string, token: string): Promise<void> {
    const baseUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}&tenant=${encodeURIComponent(tenantSlug)}`;
    const subject = 'Reset your password';
    const text = `Reset your password for ${tenantSlug}. Use the link below (expires in 15 minutes):\n\n${resetUrl}\n\nIf you did not request this, ignore this email.`;
    const html = `<p>Reset your password for <strong>${tenantSlug}</strong>.</p><p><a href="${resetUrl}">Reset Password</a></p><p>This link expires in 15 minutes.</p><p>If you did not request this, ignore this email.</p>`;
    await this.sendMail(email, subject, text, html);
  }

  async sendPasswordChangedEmail(email: string, tenantSlug: string): Promise<void> {
    const subject = 'Your password was changed';
    const text = `Your password for ${tenantSlug} was changed. If you did not make this change, contact your administrator immediately.`;
    const html = `<p>Your password for <strong>${tenantSlug}</strong> was changed.</p><p>If you did not make this change, contact your administrator immediately.</p>`;
    await this.sendMail(email, subject, text, html);
  }

  async sendEmailVerificationEmail(email: string, tenantSlug: string, token: string): Promise<void> {
    const baseUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const verifyUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(token)}&tenant=${encodeURIComponent(tenantSlug)}`;
    const subject = 'Verify your email address';
    const text = `Verify your email address for ${tenantSlug}. Use the link below (expires in 1 hour):\n\n${verifyUrl}\n\nIf you did not create this account, ignore this email.`;
    const html = `<p>Verify your email address for <strong>${tenantSlug}</strong>.</p><p><a href="${verifyUrl}">Verify Email</a></p><p>This link expires in 1 hour.</p><p>If you did not create this account, ignore this email.</p>`;
    await this.sendMail(email, subject, text, html);
  }
}
