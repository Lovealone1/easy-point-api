import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import nodemailer, { type SendMailOptions, type Transporter } from 'nodemailer';
import appConfig from '../../common/config/config.js';
import { AppLogger } from '../../common/logger/app.logger.js';

@Injectable()
export class MailService {
  private readonly logger = new AppLogger();
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
  ) {
    const { host, port, user, password, from } = this.config.smtp;

    // We interpolate the "Alias" alongside the validated email from SMTP_FROM
    this.from = `"Equipo de Seguridad Easy Point" <${from}>`;
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: false,
      auth: {
        user,
        pass: password,
      },
    });
  }

  async sendMail(
    to: string,
    subject: string,
    html: string,
  ): Promise<boolean> {
    const mailOptions: SendMailOptions = {
      from: this.from,
      to,
      subject,
      html,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email sent successfully to ${to} with subject "${subject}"`);
      return true;
    } catch (error) {
      const mailError = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to send email to ${to}: ${mailError.message}`,
        mailError.stack,
      );
      return false;
    }
  }
}
