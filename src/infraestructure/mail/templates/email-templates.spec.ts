import { getOtpEmailTemplate } from './otp.template.js';
import { getInvitationEmailTemplate } from './invitation.template.js';
import { getSubscriptionRenewalReminderTemplate, getSubscriptionCancelledTemplate } from './subscription.template.js';
import { EMAIL_LOGO_SRC } from './email.utils.js';

describe('email rendering', () => {
  it.each([
    ['LOGIN', 120, 'Verify your login attempt'],
    ['REGISTER', 120, 'Confirm your email address'],
    ['LOGIN', 900, 'Verify your login attempt'],
    ['CHANGE_EMAIL', 900, 'Confirm your new email address'],
  ])('renders %s with its actual %i-second validity', (intent, ttl, title) => {
    const html = getOtpEmailTemplate('123456', intent, EMAIL_LOGO_SRC, ttl);
    expect(html).toContain(title);
    expect(html).toContain('<p class="code">123456</p>');
    expect(html).toContain(`Expires in ${ttl / 60} minutes`);
    expect(html).toContain(`src="${EMAIL_LOGO_SRC}"`);
    expect(html).toContain(`&copy; ${new Date().getFullYear()}`);
    expect(html).not.toContain('${');
  });

  it('renders invitation names, role and actionable links without raw HTML injection', () => {
    const html = getInvitationEmailTemplate('A & <Company>', 'Owner "Admin"', 'https://app.example/auth/invitation?token=abc&source=email', EMAIL_LOGO_SRC);
    expect(html).toContain('A &amp; &lt;Company&gt;');
    expect(html).toContain('Owner &quot;Admin&quot;');
    expect(html).toContain('href="https://app.example/auth/invitation?token=abc&amp;source=email"');
    expect(html).toContain(`src="${EMAIL_LOGO_SRC}"`);
    expect(html).toContain(`&copy; ${new Date().getFullYear()}`);
    expect(html).not.toContain('${');
  });

  it('renders subscription dates, names and links in both lifecycle emails', () => {
    const common = { organizationName: '<Company>', planName: 'Basic & Plus', logoUrl: EMAIL_LOGO_SRC };
    const renewal = getSubscriptionRenewalReminderTemplate({ ...common, daysLeft: 1, renewalDate: '19 de septiembre de 2026', renewalLink: 'https://app.example/billing' });
    const cancelled = getSubscriptionCancelledTemplate({ ...common, cancelledAt: '20 de septiembre de 2026', reactivateLink: 'https://app.example/billing' });
    expect(renewal).toContain('19 de septiembre de 2026');
    expect(renewal).toContain('day remaining');
    expect(cancelled).toContain('20 de septiembre de 2026');
    for (const html of [renewal, cancelled]) {
      expect(html).toContain('&lt;Company&gt;');
      expect(html).toContain('Basic &amp; Plus');
      expect(html).toContain('href="https://app.example/billing"');
      expect(html).toContain(`src="${EMAIL_LOGO_SRC}"`);
      expect(html).toContain(`&copy; ${new Date().getFullYear()}`);
      expect(html).not.toContain('${');
    }
  });
});
