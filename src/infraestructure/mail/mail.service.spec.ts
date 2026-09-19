import nodemailer from 'nodemailer';
import { ServiceUnavailableException } from '@nestjs/common';
import { MailService } from './mail.service.js';
import { getOtpEmailTemplate } from './templates/otp.template.js';
import { EMAIL_LOGO_CID, EMAIL_LOGO_SRC } from './templates/email.utils.js';

describe('MailService', () => {
  const config = { smtp: { host: 'smtp.example', port: 587, user: 'sender@example.com', password: 'test', from: 'sender@example.com' } } as any;
  afterEach(() => jest.restoreAllMocks());

  it('builds a real MIME message with the bundled PNG and matching CID without sending mail', async () => {
    const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
    const send = jest.spyOn(transport, 'sendMail');
    jest.spyOn(nodemailer, 'createTransport').mockReturnValue(transport as any);
    const service = new MailService(config);
    await expect(service.sendMail('user@example.com', 'OTP', getOtpEmailTemplate('123456', 'LOGIN', EMAIL_LOGO_SRC, 120))).resolves.toBe(true);
    const info = await send.mock.results[0].value;
    const mime = info.message.toString();
    expect(mime).toContain(`Content-ID: <${EMAIL_LOGO_CID}>`);
    expect(mime).toContain('Content-Type: image/png');
    expect(mime).toContain('Content-Disposition: inline');
    expect(mime).toContain('iVBOR');
    expect(mime).not.toContain('${');
  });

  it('reports SMTP failures instead of returning a false success to callers', async () => {
    jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail: jest.fn().mockRejectedValue(new Error('SMTP unavailable')) } as any);
    await expect(new MailService(config).sendMail('user@example.com', 'OTP', '<p>code</p>')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
