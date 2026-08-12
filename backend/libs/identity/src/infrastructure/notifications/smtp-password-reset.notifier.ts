import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import type { PasswordResetNotifierPort } from '../../application';

@Injectable()
export class SmtpPasswordResetNotifier implements PasswordResetNotifierPort {
  private readonly transporter: Transporter;
  private readonly from: string;
  private readonly appUrl: string;

  constructor(config: ConfigService) {
    const smtp = config.getOrThrow<{
      host?: string;
      port?: number;
      secure: boolean;
      user?: string;
      password?: string;
      from?: string;
    }>('app.smtp');
    if (
      !smtp.host ||
      !smtp.port ||
      !smtp.user ||
      !smtp.password ||
      !smtp.from
    ) {
      throw new Error('SMTP configuration is incomplete');
    }
    this.from = smtp.from;
    this.appUrl = config.getOrThrow<string>('app.url');
    this.transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.user, pass: smtp.password },
    });
  }

  async sendPasswordReset(email: string, token: string): Promise<void> {
    const link = `${this.appUrl}/reset-password?token=${encodeURIComponent(token)}`;
    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject: 'Reset your LMS password',
      text: `Use this one-time link to reset your password: ${link}`,
    });
  }
}
