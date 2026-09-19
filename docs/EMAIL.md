# Transactional email

`MailService` sends the HTML rendered by the OTP, invitation and subscription
templates. Template variables must use JavaScript interpolation (`${value}`),
not escaped interpolation (`\${value}`). Dynamic names and attribute values are
HTML-escaped before insertion.

## OTP validity

| Flow | Environment | Redis TTL |
| --- | --- | --- |
| Login / registration | production | 120 seconds (2 minutes) |
| Login / registration | other | 900 seconds (15 minutes) |
| Change email | all | 900 seconds (15 minutes) |

The service passes the same TTL used for Redis to the email renderer. Expiration
starts when the hash is stored, before SMTP delivery; receipt of the message does
not restart the timer. JWT access-token expiration is a separate setting.

## Logo and delivery

All email flows use `cid:easypoint-logo@easy-point`. `MailService` attaches
`public/easypoint-resumed.png` as an inline PNG with the matching Content-ID.
The production Dockerfile already copies `public/` into `/app/public` and runs
from `/app`. This avoids depending on an externally accessible image route.
Email clients can still apply their own image-display preferences.

SMTP failures throw a generic HTTP 503 error instead of silently returning
false. Subscription background tasks catch and log these failures; this does
not add a delivery retry queue. Successful SMTP submission is not proof that
the message reached the recipient's inbox.

## Validation after deployment

Request a fresh OTP and check the code, title, description, two-minute expiry,
current copyright year and logo. Check an invitation's organization, role and
link, and a change-email OTP's fifteen-minute expiry. Existing delivered emails
cannot be repaired by deploying this change.
