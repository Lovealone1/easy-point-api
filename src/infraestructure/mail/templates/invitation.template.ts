export function getInvitationEmailTemplate(
  organizationName: string,
  roleName: string,
  invitationLink: string,
  logoUrl: string,
): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Easy Point - Invitation</title>
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
        <img class="logo" src="\${logoUrl}" alt="Easy Point Logo" />
        <h1>Easy Point</h1>
        <p>Organization Invitation</p>
      </div>
      <div class="content">
        <div class="badge">Invitation</div>
        <h2>You've been invited!</h2>
        <p class="description">
          You have been invited to join <strong>\${organizationName}</strong> with the role of <strong>\${roleName}</strong>.<br>
          Click the button below to accept your invitation and join the organization.
        </p>
        
        <div class="btn-container">
          <a href="\${invitationLink}" class="btn">Accept Invitation</a>
        </div>

        <div class="link-container">
          <p>Or copy and paste this link into your browser:</p>
          <a href="\${invitationLink}">\${invitationLink}</a>
        </div>
      </div>
      <div class="footer">
        <p>If you don't know this organization, you can safely ignore this email.</p>
        <p class="copyright">&copy; \${new Date().getFullYear()} Easy Point. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}
