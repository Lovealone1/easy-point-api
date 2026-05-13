# Audit Log System — Technical Guide

## Architecture Overview

```
HTTP Request
     │
     ▼
RequestInfoMiddleware
  │  Generates unique requestId
  │  Patches AsyncLocalStorage: { requestId, ipAddress, userAgent }
     │
     ▼
TenantMiddleware
  │  Sets AsyncLocalStorage: { organizationId }
     │
     ▼
JwtAuthGuard
  │  Validates JWT, sets req.user = { sub, email, sid, role }
  │  (AuditService.patchUserContext() may be called here in future)
     │
     ▼
Business Logic (Service)
  │
  │  Option A: Manual call
  │  ┌─────────────────────────────────────────────────────────────────┐
  │  │ this.auditService.log({                                         │
  │  │   action: AuditAction.UPDATE, resourceType: 'Client',          │
  │  │   before: originalClient, after: updatedClient,                 │
  │  │ });                                                             │
  │  └─────────────────────────────────────────────────────────────────┘
  │
  │  Option B: Decorator (captures `after` only)
  │  ┌─────────────────────────────────────────────────────────────────┐
  │  │ @Audit({ action: AuditAction.UPDATE, resource: 'Client' })      │
  │  │ @UseInterceptors(AuditInterceptor)                              │
  │  │ async update(...)  { ... }                                      │
  │  └─────────────────────────────────────────────────────────────────┘
     │
     ▼
AuditService.log()  ← fire-and-forget (microtask queue)
  1. Reads AsyncLocalStorage context (tenantId, userId, ip, etc.)
  2. Computes changedFields diff (if before + after provided)
  3. Sanitizes all payloads (removes passwords, tokens, secrets)
  4. Emits 'audit.log' event via EventEmitter2
     │
     ▼
AuditConsumer.handleAuditEvent()  ← @OnEvent('audit.log', { async: true })
  ├── AuditRepository.create()  →  PostgreSQL (audit_logs table)
  └── process.stdout.write()    →  Structured JSON line (log shippers)
```

---

## Data Model

The `audit_logs` table is **append-only**. Never `UPDATE` or `DELETE` rows from application code.

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `tenantId` | String | Organization that performed the action |
| `userId` | String? | User who acted (null for system/anonymous) |
| `impersonatedBy` | String? | Reserved for admin impersonation feature |
| `action` | AuditAction | What happened (enum) |
| `resourceType` | String | Entity type: `"Client"`, `"Sale"`, `"Role"` |
| `resourceId` | String? | Primary key of the affected record |
| `before` | Json? | Full entity snapshot BEFORE the operation |
| `after` | Json? | Full entity snapshot AFTER the operation |
| `changedFields` | Json? | Granular diff: `{ field: { before, after } }` |
| `metadata` | Json? | Free-form context (reason, batch ID, etc.) |
| `ipAddress` | String? | Originating IP address |
| `userAgent` | String? | Browser/client identifier |
| `requestId` | String? | UUID per HTTP request (for correlation) |
| `sessionId` | String? | JWT session ID |
| `severity` | AuditSeverity | LOW / MEDIUM / HIGH / CRITICAL |
| `createdAt` | DateTime | UTC timestamp (immutable) |

### changedFields Format

For UPDATE operations the `changedFields` field contains a granular field-level diff:

```json
{
  "changedFields": {
    "name": {
      "before": "Acme SA",
      "after":  "Acme Corp"
    },
    "creditLimit": {
      "before": "500.00",
      "after":  "1000.00"
    }
  }
}
```

This is computed **automatically** by `AuditService` when both `before` and `after` are provided. Fields that did not change are **excluded** from the diff.

---

## Audit Actions & Default Severity

| Action | Default Severity | Typical Use Case |
|---|---|---|
| `LOGIN` | LOW | Successful authentication |
| `LOGOUT` | LOW | Session termination |
| `CREATE` | MEDIUM | Resource creation |
| `UPDATE` | MEDIUM | Resource modification |
| `RESTORE` | MEDIUM | Soft-delete restore |
| `EXPORT` | MEDIUM | Data export |
| `DELETE` | HIGH | Hard delete |
| `CANCEL` | HIGH | Order/sale cancellation |
| `ROLE_CHANGE` | HIGH | User role assignment |
| `PERMISSION_CHANGE` | HIGH | Permission modification |
| `TENANT_CONFIG_CHANGE` | HIGH | Organization settings change |
| `LOGIN_FAILED` | CRITICAL | Failed authentication attempt |
| `SESSION_KILL` | CRITICAL | Forced session termination |
| `PASSWORD_CHANGE` | CRITICAL | Credential update |
| `API_KEY_CHANGE` | CRITICAL | API key rotation/revocation |

---

## How to Use

### Option 1: Manual Service Call (Recommended for full before/after diff)

```typescript
import { AuditService } from '../../audit/audit.service.js';
import { AuditAction } from '../../audit/enums/audit-action.enum.js';

@Injectable()
export class ClientsService {
  constructor(
    private readonly auditService: AuditService, // Globally available — no import needed
    // ...
  ) {}

  async update(id: string, orgId: string, dto: UpdateClientDto) {
    // 1. Fetch current state for before snapshot
    const before = await this.repository.findById(id);

    // 2. Perform the mutation
    const after = await this.repository.update(id, dto);

    // 3. Log audit — fire-and-forget, does NOT block the response
    this.auditService.log({
      action: AuditAction.UPDATE,
      resourceType: 'Client',
      resourceId: id,
      before: { ...before },    // Full snapshot BEFORE
      after: { ...after },      // Full snapshot AFTER
      // changedFields is computed automatically from before/after
      metadata: { reason: dto.updateReason }, // Optional business context
    });

    return after;
  }

  async remove(id: string, orgId: string) {
    const before = await this.repository.findById(id);
    const deleted = await this.repository.delete(id);

    this.auditService.log({
      action: AuditAction.DELETE,
      resourceType: 'Client',
      resourceId: id,
      before: { ...before },
      // severity: AuditSeverity.HIGH is inferred automatically for DELETE
    });

    return deleted;
  }
}
```

### Option 2: Decorator (Captures `after` state only)

```typescript
import { Audit } from '../../common/decorators/audit.decorator.js';
import { AuditInterceptor } from '../../common/interceptors/audit.interceptor.js';
import { AuditAction } from '../../modules/audit/enums/audit-action.enum.js';

@Controller('clients')
@UseInterceptors(AuditInterceptor) // Register once per controller
export class ClientsController {

  @Post()
  @Audit({ action: AuditAction.CREATE, resource: 'Client' })
  async create(@Body() dto: CreateClientDto) {
    return this.clientsService.create(dto);
    // The response body is automatically captured as `after`
  }

  @Delete(':id')
  @Audit({ action: AuditAction.DELETE, resource: 'Client', severity: AuditSeverity.HIGH })
  async remove(@Param('id') id: string) {
    return this.clientsService.remove(id);
  }
}
```

> **Note:** The decorator only captures the `after` state (handler response body).
> For full `before`/`after` diff on UPDATE, use the manual service call in Option 1.

### Option 3: Manual with Awaitable logSync (for critical auth events)

```typescript
// Use logSync when you NEED the event to be guaranteed before returning
await this.auditService.logSync({
  action: AuditAction.LOGIN_FAILED,
  resourceType: 'Session',
  metadata: { email, reason: 'INVALID_OTP' },
  severity: AuditSeverity.CRITICAL,
});
```

---

## Query API

All endpoints require:
- `Authorization: Bearer <token>` (valid JWT)
- `x-organization-id: <orgId>` header
- `GlobalRole.ADMIN`

### List audit logs with filters

```
GET /api/v1/audit?action=UPDATE&resourceType=Client&severity=HIGH&page=1&limit=20
```

Query parameters:
- `action` — filter by `AuditAction` enum value
- `resourceType` — e.g. `Client`, `Sale`, `Role`
- `resourceId` — UUID of specific entity
- `userId` — filter by user UUID
- `severity` — LOW / MEDIUM / HIGH / CRITICAL
- `startDate` / `endDate` — ISO 8601 date range
- `requestId` — correlate all events from a single HTTP request
- `page`, `limit`, `order`, `orderBy` — standard pagination

### Entity history

```
GET /api/v1/audit/entity/Client/abc-123
```

Returns the full chronological audit trail for a specific record. Answers:
- "Who deleted this client?"
- "What fields changed in the last update?"
- "From which IP was this accessed?"

---

## Structured Log Output

Every audit event emits a JSON line to `stdout`:

```json
{
  "type": "audit",
  "tenantId": "org-uuid",
  "userId": "user-uuid",
  "action": "UPDATE",
  "resourceType": "Client",
  "resourceId": "client-uuid",
  "severity": "MEDIUM",
  "requestId": "req-uuid",
  "sessionId": "session-uuid",
  "ipAddress": "192.168.1.1",
  "changedFieldKeys": ["name", "creditLimit"],
  "timestamp": "2026-05-12T21:00:00.000Z"
}
```

Log shippers can filter with: `json.type == "audit"` (Loki), `@type:audit` (Elastic), etc.

---

## Sanitization

The following field names are **automatically redacted** to `[REDACTED]` before any data reaches the audit store or logs:

`password`, `passwordHash`, `accessToken`, `refreshToken`, `token`, `secret`, `clientSecret`, `apiKey`, `apiSecret`, `privateKey`, `secretKey`, `signingKey`, `encryptionKey`, `authorization`, `cookie`, `otp`, `verificationCode`, `resetCode`, `pin`, `ssn`, `taxId`, `nationalId`

Sanitization is applied recursively to `before`, `after`, and `metadata` fields.

---

## Extending the System

### Adding a new audit sink (e.g. Kafka, Webhook)

1. Create a new consumer class:

```typescript
@Injectable()
export class AuditKafkaConsumer {
  @OnEvent(AUDIT_LOG_EVENT, { async: true })
  async handleAuditEvent(event: AuditLogEvent): Promise<void> {
    // Publish to Kafka topic
  }
}
```

2. Register it as a provider in `AuditModule`.

### Adding audit to an existing module

Since `AuditModule` is `@Global()`, just inject `AuditService` directly — no module import needed:

```typescript
constructor(private readonly auditService: AuditService) {}
```

### Auditing a new critical action

1. The `AuditAction` enum covers most cases. If you need a new action, add it to:
   - `prisma/schema.prisma` → `enum AuditAction`
   - `src/modules/audit/enums/audit-action.enum.ts`
   - Run `npx prisma db push && npx prisma generate`

---

## Troubleshooting

**Q: Audit logs are not appearing in the database**
- Check that the dev server restarted after the schema push
- Verify the `audit_logs` table exists: `\d audit_logs` in psql
- Check for errors in the `[AuditConsumer]` logger output

**Q: `changedFields` is empty on an UPDATE**
- Ensure you are passing both `before` AND `after` to `auditService.log()`
- The diff is only computed when both snapshots are provided

**Q: The audit event fires but I don't see the user ID**
- `userId` is populated from AsyncLocalStorage, which is set by `JwtAuthGuard`
- If the endpoint is public (no JWT guard), `userId` will be `undefined`
- Alternatively, pass `userId` explicitly: `auditService.log({ userId: user.id, ... })`

**Q: Sensitive data appeared in an audit log**
- Add the field key to `SENSITIVE_KEYS` in `audit.sanitizer.ts`
- Ensure `before`/`after` objects are plain JS objects (not Prisma instances with getters)
