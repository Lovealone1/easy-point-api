export interface SubscriptionRenewalParams {
  organizationName: string;
  planName: string;
  daysLeft: number;
  renewalDate: string;
  renewalLink: string;
  logoUrl: string;
}

export interface SubscriptionCancelledParams {
  organizationName: string;
  planName: string;
  cancelledAt: string;
  reactivateLink: string;
  logoUrl: string;
}

export function getSubscriptionRenewalReminderTemplate(params: SubscriptionRenewalParams): string {
  const { organizationName, planName, daysLeft, renewalDate, renewalLink, logoUrl } = params;

  // Set urgency colors and labels based on days remaining
  let badgeText = 'Subscription Notice';
  let badgeBg = '#ead9f2'; // brand-100
  let badgeColor = '#51156f'; // brand-700
  let countColor = '#8b1fc1'; // brand-500

  if (daysLeft <= 3) {
    badgeText = '⚠️ Action Required';
    badgeBg = '#fee2e2'; // light red
    badgeColor = '#991b1b'; // dark red
    countColor = '#ef4444'; // red
  } else if (daysLeft <= 7) {
    badgeText = '⚠️ Expiry Approaching';
    badgeBg = '#fef9c3'; // light yellow
    badgeColor = '#854d0e'; // dark yellow
    countColor = '#eab308'; // yellow
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Easy Point - Subscription Renewal</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f6f1f9;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      color: #38114b;
    }
    .wrapper {
      width: 100%;
      background-color: #f6f1f9;
      padding: 40px 20px;
      box-sizing: border-box;
    }
    .main-container {
      width: 100%;
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 18px;
      overflow: hidden;
      box-shadow: 0 8px 30px rgba(33, 12, 44, 0.06);
      border: 1px solid #ead9f2;
    }
    .header {
      background-color: #120717;
      color: #ffffff;
      text-align: center;
      padding: 32px 20px;
    }
    .header img.logo {
      height: 40px;
      margin-bottom: 12px;
      display: inline-block;
      vertical-align: middle;
    }
    .header h1 {
      margin: 0;
      font-size: 22px;
      font-weight: 600;
      letter-spacing: -0.02em;
      color: #ffffff;
    }
    .header p {
      margin: 6px 0 0 0;
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #ead9f2;
    }
    .content {
      padding: 40px 32px;
      text-align: center;
    }
    .badge {
      display: inline-block;
      background-color: ${badgeBg};
      color: ${badgeColor};
      font-size: 12px;
      font-weight: 600;
      padding: 6px 16px;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 24px;
    }
    .content h2 {
      margin: 0 0 16px 0;
      color: #120717;
      font-size: 28px;
      font-weight: 600;
      letter-spacing: -0.025em;
      line-height: 1.2;
    }
    .content p.description {
      margin: 0 0 32px 0;
      color: #38114b;
      font-size: 16px;
      line-height: 1.6;
    }
    .counter-container {
      background-color: #f6f1f9;
      border: 1px solid #ead9f2;
      border-radius: 18px;
      padding: 24px;
      margin-bottom: 32px;
    }
    .counter-number {
      font-size: 48px;
      font-weight: 800;
      color: ${countColor};
      line-height: 1;
      margin-bottom: 6px;
    }
    .counter-label {
      font-size: 12px;
      font-weight: 600;
      color: #6b1a93;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .btn-container {
      margin: 0 auto 32px auto;
    }
    .btn {
      display: inline-block;
      background-color: #8b1fc1;
      color: #ffffff;
      text-decoration: none;
      font-size: 16px;
      font-weight: 600;
      padding: 14px 32px;
      border-radius: 9999px;
      box-shadow: 0 4px 12px rgba(139, 31, 193, 0.25);
    }
    .link-container {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #ead9f2;
      word-break: break-all;
    }
    .link-container p {
      font-size: 13px;
      color: #6b1a93;
      margin: 0 0 8px 0;
    }
    .link-container a {
      font-size: 13px;
      color: #8b1fc1;
      text-decoration: underline;
    }
    .footer {
      background-color: #210c2c;
      padding: 32px;
      text-align: center;
      color: #ead9f2;
      font-size: 12px;
      line-height: 1.6;
    }
    .footer p {
      margin: 0 0 8px 0;
    }
    .footer p.copyright {
      margin: 0;
      color: #bf79e2;
      font-size: 11px;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="main-container">
      <div class="header">
        <img class="logo" src="${logoUrl}" alt="Easy Point Logo" />
        <h1>Easy Point</h1>
        <p>Subscription Renewal</p>
      </div>
      <div class="content">
        <div class="badge">${badgeText}</div>
        <h2>Renewal Reminder</h2>
        <p class="description">
          The subscription to the plan <strong>${planName}</strong> for organization <strong>${organizationName}</strong> will expire/renew on <strong>${renewalDate}</strong>.
        </p>
        
        <div class="counter-container">
          <div class="counter-number">${daysLeft}</div>
          <div class="counter-label">${daysLeft === 1 ? 'day' : 'days'} remaining</div>
        </div>

        <div class="btn-container">
          <a href="${renewalLink}" class="btn">Manage Subscription</a>
        </div>

        <div class="link-container">
          <p>Or copy and paste this link into your browser:</p>
          <a href="${renewalLink}">${renewalLink}</a>
        </div>
      </div>
      <div class="footer">
        <p>This is a billing notification regarding your active Easy Point subscription.</p>
        <p class="copyright">&copy; ${new Date().getFullYear()} Easy Point. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function getSubscriptionCancelledTemplate(params: SubscriptionCancelledParams): string {
  const { organizationName, planName, cancelledAt, reactivateLink, logoUrl } = params;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Easy Point - Subscription Cancelled</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f6f1f9;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      color: #38114b;
    }
    .wrapper {
      width: 100%;
      background-color: #f6f1f9;
      padding: 40px 20px;
      box-sizing: border-box;
    }
    .main-container {
      width: 100%;
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 18px;
      overflow: hidden;
      box-shadow: 0 8px 30px rgba(33, 12, 44, 0.06);
      border: 1px solid #ead9f2;
    }
    .header {
      background-color: #120717;
      color: #ffffff;
      text-align: center;
      padding: 32px 20px;
    }
    .header img.logo {
      height: 40px;
      margin-bottom: 12px;
      display: inline-block;
      vertical-align: middle;
    }
    .header h1 {
      margin: 0;
      font-size: 22px;
      font-weight: 600;
      letter-spacing: -0.02em;
      color: #ffffff;
    }
    .header p {
      margin: 6px 0 0 0;
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #ead9f2;
    }
    .content {
      padding: 40px 32px;
      text-align: center;
    }
    .badge {
      display: inline-block;
      background-color: #fee2e2; /* light red */
      color: #991b1b; /* dark red */
      font-size: 12px;
      font-weight: 600;
      padding: 6px 16px;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 24px;
    }
    .content h2 {
      margin: 0 0 16px 0;
      color: #120717;
      font-size: 28px;
      font-weight: 600;
      letter-spacing: -0.025em;
      line-height: 1.2;
    }
    .content p.description {
      margin: 0 0 32px 0;
      color: #38114b;
      font-size: 16px;
      line-height: 1.6;
    }
    .btn-container {
      margin: 0 auto 32px auto;
    }
    .btn {
      display: inline-block;
      background-color: #8b1fc1;
      color: #ffffff;
      text-decoration: none;
      font-size: 16px;
      font-weight: 600;
      padding: 14px 32px;
      border-radius: 9999px;
      box-shadow: 0 4px 12px rgba(139, 31, 193, 0.25);
    }
    .link-container {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #ead9f2;
      word-break: break-all;
    }
    .link-container p {
      font-size: 13px;
      color: #6b1a93;
      margin: 0 0 8px 0;
    }
    .link-container a {
      font-size: 13px;
      color: #8b1fc1;
      text-decoration: underline;
    }
    .footer {
      background-color: #210c2c;
      padding: 32px;
      text-align: center;
      color: #ead9f2;
      font-size: 12px;
      line-height: 1.6;
    }
    .footer p {
      margin: 0 0 8px 0;
    }
    .footer p.copyright {
      margin: 0;
      color: #bf79e2;
      font-size: 11px;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="main-container">
      <div class="header">
        <img class="logo" src="${logoUrl}" alt="Easy Point Logo" />
        <h1>Easy Point</h1>
        <p>Subscription Cancelled</p>
      </div>
      <div class="content">
        <div class="badge">Cancelled</div>
        <h2>Subscription Deactivated</h2>
        <p class="description">
          The subscription to the plan <strong>${planName}</strong> for organization <strong>${organizationName}</strong> was cancelled on <strong>${cancelledAt}</strong>. You have lost access to the premium features of your administrative panel.
        </p>
        
        <p class="description" style="font-size: 14px; margin-top: -16px; margin-bottom: 32px; color: #6b1a93;">
          To regain access to your administrative panel and modules, click the button below to reactivate your subscription.
        </p>

        <div class="btn-container">
          <a href="${reactivateLink}" class="btn">Reactivate Subscription</a>
        </div>

        <div class="link-container">
          <p>Or copy and paste this link into your browser:</p>
          <a href="${reactivateLink}">${reactivateLink}</a>
        </div>
      </div>
      <div class="footer">
        <p>This is a billing notification regarding your deactivated Easy Point subscription.</p>
        <p class="copyright">&copy; ${new Date().getFullYear()} Easy Point. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}
