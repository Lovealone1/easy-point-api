export function getOtpEmailTemplate(otp: string, intent: string): string {
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

  // We no longer format the OTP with physical spaces. 
  // Instead, we will use CSS letter-spacing so that when the user double-taps 
  // or copies the code, it copies as a single continuous string (e.g. "123456").

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
      background-color: #f4f4f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f4f4f5;
      padding: 40px 20px;
      box-sizing: border-box;
    }
    .main-container {
      width: 100%;
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }
    .header {
      background-color: #3f3f46;
      color: #ffffff;
      text-align: center;
      padding: 32px 20px;
    }
    .header h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.025em;
    }
    .header p {
      margin: 8px 0 0 0;
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #a1a1aa;
    }
    .content {
      padding: 32px 20px;
      text-align: center;
    }
    .content h2 {
      margin: 0 0 16px 0;
      color: #18181b;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.025em;
    }
    .content p.description {
      margin: 0 0 40px 0;
      color: #52525b;
      font-size: 15px;
      line-height: 1.6;
    }
    .code-container {
      background-color: #fafafa;
      border: 1px solid #e4e4e7;
      border-radius: 12px;
      padding: 32px 20px;
      margin: 0 auto;
    }
    .code-container .label {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: #a1a1aa;
      margin: 0 0 12px 0;
    }
    .code-container .code {
      font-size: 40px;
      font-weight: 800;
      letter-spacing: 0.2em; /* CSS letter-spacing instead of physical spaces */
      color: #18181b;
      margin: 0 0 12px 0;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      user-select: all; /* Makes it easy to select the whole code on double tap */
      -webkit-user-select: all;
    }
    .code-container .expires {
      font-size: 13px;
      color: #a1a1aa;
      margin: 0;
    }
    .footer {
      padding: 0 32px 32px 32px;
      text-align: center;
      color: #a1a1aa;
      font-size: 12px;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="main-container">
      <div class="header">
        <h1>Easy Point Auth</h1>
        <p>Security OTP</p>
      </div>
      <div class="content">
        <h2>${mainTitle}</h2>
        <p class="description">${description}</p>
        
        <div class="code-container">
          <p class="label">VERIFICATION CODE</p>
          <p class="code">${otp}</p>
          <p class="expires">Expires in 15 minutes</p>
        </div>
      </div>
      <div class="footer">
        If you didn't request this code, you can safely ignore this email.
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}
