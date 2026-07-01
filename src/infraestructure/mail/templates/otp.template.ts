export function getOtpEmailTemplate(otp: string, intent: string, logoUrl: string): string {
  const isRegister = intent === 'REGISTER';
  const isChangeEmail = intent === 'CHANGE_EMAIL';
  const mainTitle = isRegister
    ? 'Confirm your email address'
    : isChangeEmail
      ? 'Confirm your new email address'
      : 'Verify your login attempt';
  const description = isRegister
    ? 'Use the code below to verify your email and complete your registration for Easy Point.'
    : isChangeEmail
      ? 'Use the code below to confirm and verify your new email address in the administrative panel.'
      : 'Use the code below to verify your identity and complete your login to Easy Point.';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Easy Point - OTP</title>
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
      background-color: #ead9f2;
      color: #51156f;
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
    .code-container {
      background-color: #f6f1f9;
      border: 1px solid #d6aeea;
      border-radius: 18px;
      padding: 32px 20px;
      margin: 0 auto;
    }
    .code-container .label {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: #6b1a93;
      margin: 0 0 12px 0;
    }
    .code-container .code {
      font-size: 40px;
      font-weight: 800;
      letter-spacing: 0.2em;
      color: #51156f;
      margin: 0 0 12px 0;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      user-select: all;
      -webkit-user-select: all;
    }
    .code-container .expires {
      font-size: 13px;
      color: #6b1a93;
      margin: 0;
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
        <img class="logo" src="\${logoUrl}" alt="Easy Point Logo" />
        <h1>Easy Point Auth</h1>
        <p>Security OTP</p>
      </div>
      <div class="content">
        <div class="badge">Verification</div>
        <h2>\${mainTitle}</h2>
        <p class="description">\${description}</p>
        
        <div class="code-container">
          <p class="label">VERIFICATION CODE</p>
          <p class="code">\${otp}</p>
          <p class="expires">Expires in 15 minutes</p>
        </div>
      </div>
      <div class="footer">
        <p>If you didn't request this code, you can safely ignore this email.</p>
        <p class="copyright">&copy; \${new Date().getFullYear()} Easy Point. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}
