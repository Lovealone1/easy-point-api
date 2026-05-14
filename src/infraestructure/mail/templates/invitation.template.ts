export function getInvitationEmailTemplate(
  organizationName: string,
  roleName: string,
  invitationLink: string,
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
    .btn-container {
      margin: 0 auto;
    }
    .btn {
      display: inline-block;
      background-color: #18181b;
      color: #ffffff;
      text-decoration: none;
      font-size: 16px;
      font-weight: 600;
      padding: 14px 28px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .btn:hover {
      background-color: #27272a;
    }
    .link-container {
      margin-top: 32px;
      word-break: break-all;
    }
    .link-container p {
      font-size: 13px;
      color: #a1a1aa;
      margin: 0;
    }
    .link-container a {
      font-size: 13px;
      color: #3b82f6;
      text-decoration: underline;
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
        <h1>Easy Point</h1>
        <p>Organization Invitation</p>
      </div>
      <div class="content">
        <h2>You've been invited!</h2>
        <p class="description">
          You have been invited to join <strong>${organizationName}</strong> with the role of <strong>${roleName}</strong>.
          Click the button below to accept your invitation and join the organization.
        </p>
        
        <div class="btn-container">
          <a href="${invitationLink}" class="btn">Accept Invitation</a>
        </div>

        <div class="link-container">
          <p>Or copy and paste this link into your browser:</p>
          <a href="${invitationLink}">${invitationLink}</a>
        </div>
      </div>
      <div class="footer">
        If you don't know this organization, you can safely ignore this email.
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}
