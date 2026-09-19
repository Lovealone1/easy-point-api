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

## The hourly code budget is refunded on success

Each address may request 3 codes per hour, per application
(`otp:hourly_count:<channel>:<email>`), with a 60-second cooldown between
them. A **correct** code gives its own request back.

The budget exists to stop someone mail-bombing an address they do not
control. Entering the right code proves the opposite, so charging for it buys
nothing and costs real usability: three ordinary sign-ins in an hour would
otherwise lock the account out of requesting a fourth code.

Only the successful request is refunded, never the whole budget. Codes that
are requested and never used keep counting, which is exactly the pattern the
limit is watching for. The 60-second cooldown is untouched either way — it
throttles outbound mail rather than rationing sign-ins.

Refunds go through `RedisCacheService.decrIfPresent`, which never creates the
key and never resets its expiry; a plain `DECR` would do both.

## Seeing where you are signed in

Account settings reads its session list from `GET /me/sessions`, next to
`/me/preferences` in the personal space. `GET /auth/sessions` is the same data
under its older name and still works; both go through `SessionsService`.

| | Route | Reaches |
|---|---|---|
| Account settings | `GET /me/sessions` | the caller's own sessions, in the application they are signed into |
| | `DELETE /me/sessions/:sid` | one of them |
| | `POST /me/sessions/revoke-others` | all of them but the current one |
| Console | `GET /users/:userId/sessions` | one account's sessions, **both** applications |
| | `DELETE /users/:userId/sessions/:sid` | one of them, whichever application it is in |
| | `POST /users/:userId/sessions/revoke-all` | all of them, plus every refresh token |

The personal-space routes are not pinned with `@RequireSessionScope`: both
applications have an account-settings screen, and each correctly sees only its
own sessions because the scope comes off the token. The console routes carry
`@Roles(GlobalRole.ADMIN)`, which is what requires a console session — see
"Where the boundary is actually enforced" above.

The console's view is the one place that crosses the split on the read side.
An administrator looking into an account needs both halves of it, and every
revocation they perform is audited with them as the actor and the account as
`metadata.targetUserId`.

### What a row can tell you

`SessionMetadata` in Redis holds the IP and the raw `User-Agent` recorded at
sign-in, plus `lastSeenAt`. `describeUserAgent` turns the header into
`device: { browser, os, type, label }` at **read** time, not at sign-in — so
improving the parser improves every existing session's row without anyone
signing back in, and a header it cannot place still renders as "Unknown
device" rather than breaking the list.

What a row cannot tell you: a city or a country. That needs a geo-IP database
we do not ship. The IP is shown raw, which is what a user checking for an
unfamiliar device actually needs.

`lastSeenAt` is written by `JwtAuthGuard` on the request that notices it is
more than five minutes stale, through `RedisCacheService.setPreservingTtl`.
Two things that would each be a bug if done the obvious way:

- a plain `set` resets the TTL, which would make any session that is in use
  immortal — the 30-day expiry would never arrive;
- `SET ... KEEPTTL` has the opposite failure, recreating a key with *no*
  expiry if it lapsed between the read and the write.

So the remaining TTL is read and re-applied, and a key that is already gone is
left gone. The write is also never awaited: it is a convenience field on the
hot path of every authenticated request, and a slow Redis must not turn into a
failed request.

Sessions minted before `lastSeenAt` existed simply do not have it, and readers
fall back to `createdAt`. Nothing about this release signs anybody out.

### Refresh-token rows outlive the sessions they belong to

A `refresh_tokens` row carries no `sid`, so revoking one session cannot delete
the specific row that pairs with it. This is safe rather than merely tolerated:
`refreshToken()` checks Redis for the session before it rotates anything, so a
row whose session is gone cannot be redeemed — it only waits out its own
`expiresAt`. The two operations that *can* address them all —
`POST /auth/logout-all` and the console's `revoke-all` — do delete every row.

If that ever needs to be exact, the fix is to put the `sid` on the row rather
than to try to guess which row belongs to which session.

## Adding a console endpoint

Declare `@Roles(GlobalRole.ADMIN)` as before. Nothing else is needed — the
console-session requirement comes with it. If you ever add an admin route that
a dashboard user must also reach, that is a sign the route belongs in a
tenant-scoped controller instead, not a reason to loosen `RolesGuard`.
