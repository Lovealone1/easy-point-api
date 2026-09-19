# Sessions: two applications, one deployment

Easy Point serves two applications from one domain and one deployment:

- the **tenant dashboard**, where a user works inside an organization;
- the **administration console** at `/admin`, where a global administrator
  works across all of them.

They share infrastructure. They do not share a session.

## What "do not share" means precisely

| | Dashboard | Console |
|---|---|---|
| Cookies | `access_token` / `refresh_token` | `admin_access_token` / `admin_refresh_token` |
| JWT claim | `scope: "TENANT"` | `scope: "ADMIN"` |
| Redis session | `session_metadata:TENANT:<uid>:<sid>` | `session_metadata:ADMIN:<uid>:<sid>` |
| Redis session set | `user_sessions:TENANT:<uid>` | `user_sessions:ADMIN:<uid>` |
| Refresh rows | `refresh_tokens.scope = 'TENANT'` | `refresh_tokens.scope = 'ADMIN'` |
| Sign-in | `POST /auth/otp` + `/auth/otp/verify` | `POST /auth/admin/otp` + `/auth/admin/otp/verify` |
| OTP cache key | `otp:LOGIN:<email>` | `otp:ADMIN_LOGIN:<email>` |
| Lifetime | `JWT_REFRESH_EXPIRES_IN` (30d) | `JWT_ADMIN_REFRESH_EXPIRES_IN` (8h) |

Consequences, all of them deliberate:

- Opening `/admin` while signed into the dashboard asks for a code. A dashboard
  session is not a console session and never becomes one.
- Signing out of the console leaves the dashboard signed in, and the reverse.
- The emailed codes are not interchangeable: a dashboard code read aloud over
  the phone does not open the console.
- `POST /auth/logout-all` is the single deliberate exception — "sign out
  everywhere" clears both, because someone reaching for it means everything.

## Why the cookies are named, not path-scoped

The obvious design is `Path=/admin` on the console cookies. It does not work
here: the browser never talks to this API directly, it goes through the Next.js
BFF, whose routes live under `/api`. A cookie scoped to `/admin` would never be
attached to the request that actually needs it.

So isolation comes from the distinct names plus the `scope` claim inside the
token — which is the stronger guarantee anyway, since the API verifies the
claim rather than trusting where a cookie came from.

## Where the boundary is actually enforced

Four places, in order of how much they carry:

1. **`RolesGuard`** — requires `scope === ADMIN` on every route that declares
   `@Roles(GlobalRole.ADMIN)`. Because all ~31 admin controllers already carry
   that decorator, this single check puts the entire console API behind the
   console sign-in without editing any of them.
2. **`JwtAuthGuard`** — reads `scope` off the token, looks the session up in
   that scope's Redis namespace, and honours `@RequireSessionScope(...)` so the
   session-management routes cannot be driven by the other application's token.
3. **`OrgRolesGuard`** — the global-admin bypass now requires a console
   session. In the dashboard, a global admin is an ordinary member with the
   role they genuinely hold in that organization.
4. **`TenantMiddleware`** — `x-bypass-tenant` likewise requires a console
   session, or the split in (3) would leak straight back in through a header.

The Next.js edge middleware redirects `/admin/*` to `/admin/login` when the
console cookie is absent, but that is a routing convenience, not the boundary:
it only checks that a cookie exists. The API above is the authority.

## Upgrading

The release that introduces this **signs everybody out once**. Two reasons, and
both are load-bearing:

- The Redis session keys are re-namespaced, so pre-split entries are no longer
  found where the guard looks.
- `JwtAuthGuard` rejects a token with no `scope` claim rather than assuming it
  is a dashboard token, so nobody keeps a session minted before these checks
  existed.

The migration adds `refresh_tokens.scope` defaulting to `TENANT`. Existing rows
are correct under that default and are revoked on the next sign-in anyway.

## The console intent is server-chosen

`AuthIntent.ADMIN_LOGIN` is not in `CLIENT_REQUESTABLE_INTENTS`, so the public
`/auth/otp` routes reject it. Only `AdminAuthController` sets it, and only
after `generateAdminOtp` has confirmed the address belongs to an active global
administrator.

Without that restriction, anyone could ask the public route to email an
"administration console access" code to any address. It would not grant them
anything — verification still demands the ADMIN role — but it would hand a
stranger a convincing phishing lure sent over our own SMTP.

## Adding a console endpoint

Declare `@Roles(GlobalRole.ADMIN)` as before. Nothing else is needed — the
console-session requirement comes with it. If you ever add an admin route that
a dashboard user must also reach, that is a sign the route belongs in a
tenant-scoped controller instead, not a reason to loosen `RolesGuard`.
