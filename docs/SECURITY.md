# 🛡️ Easy Point API — Security Architecture

> **Última actualización:** Julio 2026  
> **Stack:** NestJS · TypeScript · Prisma · Redis (ioredis) · PostgreSQL (self-hosted) · Caddy (TLS) · S3 · JWT · Argon2  
> **Clasificación:** Documento de Arquitectura de Seguridad (Production-Ready)

---

## Tabla de Contenidos

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Arquitectura BFF (Backend For Frontend)](#2-arquitectura-bff-backend-for-frontend)
3. [Cadena de Middlewares de Seguridad](#3-cadena-de-middlewares-de-seguridad)
4. [Autenticación — Sistema Híbrido JWT + OTP](#4-autenticación--sistema-híbrido-jwt--otp)
5. [Gestión de Sesiones Stateful con Redis](#5-gestión-de-sesiones-stateful-con-redis)
6. [Autorización — Sistema de Guardias por Capas](#6-autorización--sistema-de-guardias-por-capas)
7. [Rate Limiting — Sistema Multi-Tier Basado en Redis](#7-rate-limiting--sistema-multi-tier-basado-en-redis)
8. [Aislamiento Multi-Tenant (Tenant Isolation)](#8-aislamiento-multi-tenant-tenant-isolation)
9. [Sistema de Auditoría (Audit Trail)](#9-sistema-de-auditoría-audit-trail)
10. [Protección contra Ataques Conocidos](#10-protección-contra-ataques-conocidos)
11. [Gestión de Errores y Trazabilidad](#11-gestión-de-errores-y-trazabilidad)
12. [Seguridad en la Capa de Infraestructura](#12-seguridad-en-la-capa-de-infraestructura)
13. [Seguridad a Nivel de Datos y Prisma](#13-seguridad-a-nivel-de-datos-y-prisma)
14. [Seguridad en Contenedores y DevOps](#14-seguridad-en-contenedores-y-devops)
15. [Controles de Validación de Entrada](#15-controles-de-validación-de-entrada)
16. [Recomendaciones Adicionales de Seguridad](#16-recomendaciones-adicionales-de-seguridad)
17. [Tabla Resumen de Controles de Seguridad](#17-tabla-resumen-de-controles-de-seguridad)

---

## 1. Resumen Ejecutivo

Easy Point API implementa un modelo de seguridad en profundidad (**Defense in Depth**) con múltiples capas independientes de protección. La arquitectura no depende de un único punto de control, sino de una cadena de controles que se validan de forma secuencial e independiente para cada request entrante.

```
CLIENT (Browser/Mobile)
       │
       ▼ HTTPS only
 ┌─────────────────────────────────────────────────────┐
 │               API GATEWAY / REVERSE PROXY           │  ← TLS Termination, CORS, IP Allowlist
 └─────────────────────────────────────────────────────┘
       │
       ▼
 ┌─────────────────────────────────────────────────────┐
 │              MIDDLEWARE PIPELINE                     │
 │  JsonBody → RequestInfo → Logger → Tenant → Rate    │
 └─────────────────────────────────────────────────────┘
       │
       ▼
 ┌─────────────────────────────────────────────────────┐
 │                    HELMET                            │  ← HTTP Security Headers
 └─────────────────────────────────────────────────────┘
       │
       ▼
 ┌─────────────────────────────────────────────────────┐
 │              VALIDATION PIPE                         │  ← Input Sanitization & Whitelist
 └─────────────────────────────────────────────────────┘
       │
       ▼
 ┌─────────────────────────────────────────────────────┐
 │                GUARDS (por endpoint)                 │
 │  JwtAuthGuard → RolesGuard → OrgRolesGuard          │
 │              → PermissionsGuard                      │
 └─────────────────────────────────────────────────────┘
       │
       ▼
 ┌─────────────────────────────────────────────────────┐
 │               INTERCEPTORS                           │  ← AuditInterceptor (non-blocking)
 └─────────────────────────────────────────────────────┘
       │
       ▼
 ┌─────────────────────────────────────────────────────┐
 │            CONTROLLER / SERVICE / REPO               │
 └─────────────────────────────────────────────────────┘
```

---

## 2. Arquitectura BFF (Backend For Frontend)

### ¿Qué es y cómo protege la API?

La arquitectura **BFF (Backend For Frontend)** actúa como proxy de seguridad entre los clientes (browser, mobile app) y el núcleo de la API. En lugar de exponer tokens directamente al frontend JavaScript (donde serían vulnerables a XSS), toda la gestión de tokens se delega al servidor.

### Implementación en Easy Point

#### Tokens en Cookies HttpOnly

```typescript
// src/modules/auth/auth.controller.ts
private setAuthCookies(response: Response, accessToken: string, refreshToken: string) {
  const isProduction = this.config.app.env === 'production';

  response.cookie('access_token', accessToken, {
    httpOnly: true,       // ← INACCESIBLE desde JavaScript del browser
    secure: isProduction, // ← Solo HTTPS en producción
    sameSite: 'lax',      // ← Protección contra CSRF
    maxAge: 15 * 60 * 1000, // ← Expiración: 15 minutos
  });

  response.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: this.config.jwt.refreshExpiresInMs, // ← 30 días
  });
}
```

#### ¿Por qué esta configuración es segura?

| Atributo | Valor | Protección |
|---|---|---|
| `httpOnly: true` | Siempre | Previene robo de tokens por XSS — JavaScript NO puede leer la cookie |
| `secure: true` | Solo en producción | Token solo viaja sobre HTTPS — previene interceptación en tránsito |
| `sameSite: 'lax'` | Siempre | Mitiga CSRF — la cookie NO se envía en requests cross-site (POSTs desde otro dominio) |
| `maxAge` | 15 min / 30 días | Minimiza la ventana de exposición ante token comprometido |

#### Flujo BFF completo

```
Browser                   API (BFF Layer)               Backend Core
   │                            │                              │
   │─── POST /auth/otp/verify ──►│                              │
   │                            │── verifyOtp() ───────────────►│
   │                            │◄─ { accessToken, refreshToken }│
   │◄── Set-Cookie: access_token=...; HttpOnly ────────────────│
   │◄── Set-Cookie: refresh_token=...; HttpOnly ───────────────│
   │                            │                              │
   │─── GET /api/v1/sales ──────►│ (cookie enviada automáticamente)
   │                            │── extractTokenFromHeader(cookie)
   │                            │── jwtService.verifyAsync()   │
   │                            │── Redis.get(session_metadata)│
```

La clave es que **el JavaScript del frontend jamás tiene acceso al contenido del token**. Solo el browser sabe que tiene una cookie, y la envía automáticamente. Si un atacante inyecta JavaScript malicioso (XSS), no puede robar el token.

---

## 3. Cadena de Middlewares de Seguridad

Los middlewares se ejecutan **en orden** para cada request antes de llegar a cualquier controlador. Están registrados globalmente en `AppModule` para todas las rutas (`{*path}`).

```typescript
// src/app.module.ts
consumer
  .apply(
    JsonBodyMiddleware,       // 1. Límite de payload + tipo de contenido
    RequestInfoMiddleware,    // 2. Extracción de IP y User-Agent
    AuthContextMiddleware,    // 3. Decodifica el JWT (best-effort) → puebla request.user
    LoggerMiddleware,         // 4. Logging HTTP
    TenantMiddleware,         // 5. Resolución de contexto multi-tenant (usa request.user)
    RateLimitMiddleware,      // 6. Rate limiting por tier (usa request.user)
  )
  .forRoutes('{*path}');
```

`AuthContextMiddleware` corre **antes** de los guards y nunca rechaza la request — si el token falta, expiró, o es inválido, simplemente deja `request.user` sin definir y continúa como anónimo. `JwtAuthGuard` sigue siendo la única autoridad que exige autenticación (incluyendo la verificación stateful contra Redis); este middleware solo adelanta el *contexto* para que `TenantMiddleware` y `RateLimitMiddleware` —que corren antes que cualquier guard— puedan usarlo.

### 3.1 JsonBodyMiddleware — Protección contra Payloads Abusivos

**Archivo:** `src/common/middlewares/json-body.middleware.ts`

```typescript
const JSON_BODY_LIMIT = '1mb';

private readonly jsonParser = json({
  limit: JSON_BODY_LIMIT,                             // ← Límite estricto de 1 MB
  type: (request: Request) => this.shouldParse(request),
});
```

**Controles implementados:**
- **Límite de payload:** Rechaza cuerpos JSON superiores a **1 MB** con `HTTP 413 Payload Too Large`
- **Content-Type enforcing:** Solo parsea requests con `Content-Type: application/json` o `application/*+json`
- **Bypass de documentación:** Excluye `/api/docs` del parsing (evita errores en endpoints de documentación)
- **Error estructurado:** Devuelve respuesta JSON estandarizada en lugar de stack traces nativos

**Protección contra:** Ataques de denegación de servicio mediante payloads gigantes, body bloat, memory exhaustion.

### 3.2 RequestInfoMiddleware — Trazabilidad y Contexto de Seguridad

**Archivo:** `src/common/middlewares/request-info.middleware.ts`

```typescript
use(request: RequestWithMetadata, _response: Response, next: NextFunction): void {
  request.clientIp = this.extractClientIp(request);   // IP real (resuelve X-Forwarded-For)
  request.userAgent = this.extractUserAgent(request);  // User-Agent normalizado
  request.requestId =
    (request.headers['x-request-id'] as string) || crypto.randomUUID(); // ID único de traza
```

**Características:**
- **Extracción de IP real:** Maneja headers de proxy (`X-Forwarded-For`) tomando el primer IP de la cadena (el más cercano al cliente)
- **Request ID único:** Genera un UUID criptográficamente seguro (`crypto.randomUUID()`) si no viene propagado en el header `x-request-id`, permitiendo trazabilidad distribuida
- **Integración con AsyncLocalStorage:** Patcha el contexto de auditoría global (`TenantContext`) con IP, User-Agent y RequestID para que cualquier servicio en la cadena pueda leerlos sin inyectar el objeto `Request`

### 3.3 LoggerMiddleware — Registro HTTP Completo

**Archivo:** `src/common/middlewares/logger.middleware.ts`

Registra cada request completado con: `METHOD URL STATUS_CODE CONTENT_LENGTH TIEMPO_MS USER_AGENT`

Ejemplo: `GET /api/v1/sales 200 1842b - 12ms - Mozilla/5.0 ...`

### 3.4 TenantMiddleware — Resolución de Contexto Multi-Tenant

**Archivo:** `src/common/middlewares/tenant.middleware.ts`

```typescript
// Resolución jerárquica del organizationId
let organizationId =
  (req.headers['x-organization-id'] as string) ||   // 1. Header HTTP
  (req.params?.organizationId as string) ||           // 2. Parámetro de ruta
  (req.params?.orgId as string) ||                    // 3. Parámetro alternativo
  (req.query?.organizationId as string) ||            // 4. Query string
  (req.body?.organizationId as string) ||             // 5. Body
  null;
```

Almacena el `organizationId` en **AsyncLocalStorage** (`tenantContextStorage.run(state, ...)`), lo que garantiza aislamiento por request y evita contaminación cruzada entre requests concurrentes.

**Bypass de tenant (`x-bypass-tenant`) — solo para Global Admin**

El header `x-bypass-tenant: true` desactiva el filtro automático de `organizationId` en Prisma (ver §13.1). Como `AuthContextMiddleware` corre antes en la cadena, `TenantMiddleware` puede validar el rol del caller antes de honrar ese header:

```typescript
const bypassRequested = req.headers['x-bypass-tenant'] === 'true';
const isGlobalAdmin = req.user?.role === GlobalRole.ADMIN;
const bypassTenant = bypassRequested && isGlobalAdmin;
```

Un caller que no sea `GlobalRole.ADMIN` puede enviar el header, pero se ignora silenciosamente (con un warning en logs) — nunca puede ver datos fuera de su organización.

### 3.5 RateLimitMiddleware — Control de Tráfico

Ver sección dedicada: [§7 Rate Limiting](#7-rate-limiting--sistema-multi-tier-basado-en-redis).

### 3.6 AuthContextMiddleware — Contexto de Autenticación Anticipado

**Archivo:** `src/common/middlewares/auth-context.middleware.ts`

```typescript
async use(request: Request, _response: Response, next: NextFunction): Promise<void> {
  const token = this.extractToken(request); // Header Bearer o cookie access_token

  if (token) {
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.config.jwt.secret,
      });
      request.user = payload; // ← Disponible para TenantMiddleware y RateLimitMiddleware
    } catch {
      // Token inválido/expirado: se ignora. Los guards son quienes rechazan la request.
    }
  }

  next();
}
```

Este middleware existe porque `TenantMiddleware` y `RateLimitMiddleware` corren **antes** que cualquier guard en la cadena de NestJS, pero ambos necesitan saber quién es el caller (para validar el bypass de tenant y para aplicar límites por usuario en vez de por IP). Es deliberadamente permisivo — nunca lanza excepciones — porque la autorización real sigue siendo responsabilidad exclusiva de `JwtAuthGuard`, que además hace la verificación stateful contra Redis (sesión activa) que este middleware no hace.

---

## 4. Autenticación — Sistema Híbrido JWT + OTP

### 4.1 Filosofía: Passwordless con OTP

Easy Point no usa contraseñas. El flujo de autenticación es completamente **passwordless** basado en OTP (One-Time Password) enviado al email del usuario. Esto elimina vectores de ataque como:
- Credential stuffing
- Password spraying
- Brecha de contraseñas hasheadas

### 4.2 Generación de OTP — Seguridad Criptográfica

**Archivo:** `src/modules/auth/auth.service.ts`

```typescript
private generateRandomCode(length: number = 6): string {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return crypto.randomInt(min, max).toString(); // ← crypto del módulo nativo de Node.js
}
```

`crypto.randomInt()` usa el CSPRNG (Cryptographically Secure Pseudo-Random Number Generator) del sistema operativo. **No** usa `Math.random()` que es predecible.

### 4.3 Hash de OTP con Argon2

El OTP en texto plano **nunca** se persiste. Solo se almacena su hash en Redis:

```typescript
// Generación
const newOtp = this.generateRandomCode();    // "482913" (6 dígitos)
const hashedOtp = await argon2.hash(newOtp); // "$argon2id$v=19$m=65536,t=3,p=4$..."

// Almacenamiento en Redis — solo el hash
await this.redisCacheService.set(cacheKey, hashedOtp, this.getOtpTtlSeconds());

// Verificación
if (!cachedOtpHash || !(await argon2.verify(cachedOtpHash, otp))) {
  // OTP inválido
}
```

**¿Por qué Argon2 y no bcrypt/SHA256?**

Argon2 (ganador del Password Hashing Competition 2015) es resistente a:
- Ataques con hardware especializado (GPU, ASIC)
- Ataques de diccionario
- Rainbow tables

Con la configuración por defecto (`argon2id`): `memory=65536 KB, iterations=3, parallelism=4`.

### 4.4 Cooldown y Límites de Rate en OTP (Producción)

```typescript
// Solo en producción — lógica de throttling adicional sobre el Rate Limiter global
if (this.config.app.env === 'production') {
  const cooldownKey = `otp:cooldown:${email}`;
  const hourlyKey   = `otp:hourly_count:${email}`;

  if (hasCooldown) {
    throw new HttpException('Please wait 60 seconds...', HttpStatus.TOO_MANY_REQUESTS);
  }

  if (hourlyRequests >= 3) {
    throw new HttpException('Maximum OTP requests per hour exceeded', ...);
  }

  // Cooldown de 60 segundos entre solicitudes
  await this.redisCacheService.set(cooldownKey, 'locked', 60);
  // Contador horario — expira en 3600 segundos
  await this.redisCacheService.incr(hourlyKey, 3600);
}
```

| Control | Límite | Ventana |
|---|---|---|
| Cooldown entre solicitudes | 1 request | 60 segundos |
| Límite horario por email | 3 requests | 1 hora |
| Intentos de verificación | 3 intentos | 15 minutos (bloqueo) |

### 4.5 Bloqueo por Intentos de Verificación

```typescript
// Verificar intentos previos
const attempts = await this.redisCacheService.get<number>(attemptsKey) || 0;
if (attempts >= 3) {
  // Audit de seguridad: CRÍTICO
  this.auditService.log({
    action: AuditAction.LOGIN_FAILED,
    resourceType: 'Session',
    metadata: { email, reason: 'MAX_OTP_ATTEMPTS', intent },
    severity: AuditSeverity.CRITICAL,
  });
  throw new ForbiddenException('Maximum verification attempts exceeded.');
}

// Fallo de verificación → incrementar contador (TTL 15 minutos)
await this.redisCacheService.incr(attemptsKey, 900);
```

Después de **3 intentos fallidos**, el email queda bloqueado para verificación durante **15 minutos**. Cada intento fallido se registra en el sistema de auditoría con severidad `CRITICAL`.

### 4.6 JWT — Estructura del Token

El Access Token contiene el siguiente payload:

```json
{
  "sub":       "uuid-del-usuario",
  "email":     "usuario@ejemplo.com",
  "role":      "USER",
  "sid":       "uuid-de-sesion-unico",
  "ip":        "192.168.1.1",
  "userAgent": "Mozilla/5.0 ...",
  "iat":       1719100000,
  "exp":       1719100900
}
```

| Campo | Propósito de Seguridad |
|---|---|
| `sub` | Identificador primario del usuario (UUID) |
| `role` | Rol global para bypass del guard de permisos |
| `sid` | Session ID único — permite revocación granular por sesión |
| `ip` | IP de emisión — para auditoría y detección de anomalías |
| `iat` | Issued-at en segundos Unix — usado para dirty flag de permisos |
| `exp` | Expiración: 15 minutos para Access Token |

### 4.7 Refresh Token con Rotación y Hash SHA-256

```typescript
// El refresh token NUNCA se almacena en texto plano en DB
const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
await this.prismaService.refreshToken.create({
  data: {
    tokenHash,
    userId,
    userAgent: metadata.userAgent,
    ipAddress: metadata.ip,
    expiresAt: new Date(expiresAt * 1000),
  }
});
```

**Mecanismo de rotación (Refresh Token Rotation):**

```typescript
// Al usar el refresh token:
// 1. Verificar firma JWT
// 2. Calcular hash del token recibido
// 3. Buscar el hash en DB (confirma que no fue revocado)
// 4. Verificar que la sesión Redis siga activa
// 5. Emitir NUEVOS tokens
// 6. ELIMINAR el refresh token viejo de DB y Redis
await this.prismaService.refreshToken.delete({ where: { id: storedToken.id } });
await this.redisCacheService.delete(`session_metadata:${user.id}:${decoded.sid}`);
```

Si un refresh token robado es utilizado, el token legítimo quedará invalidado en el siguiente intento, alertando al usuario de que su sesión fue comprometida.

---

## 5. Gestión de Sesiones Stateful con Redis

### 5.1 Diseño Híbrido — JWT Stateless + Redis Stateful

El sistema combina lo mejor de ambos mundos:

- **JWT**: Validación criptográfica rápida sin consulta a DB
- **Redis**: Control de revocación en tiempo real

```typescript
// JwtAuthGuard — Doble verificación
async canActivate(context: ExecutionContext): Promise<boolean> {
  const token = this.extractTokenFromHeader(request);

  // 1. Verificar firma JWT (criptográfico, sin I/O)
  const payload = await this.jwtService.verifyAsync(token, {
    secret: process.env.JWT_SECRET,
  });

  // 2. Verificar que la sesión aún existe en Redis (STATEFUL CHECK)
  const sessionKey = `session_metadata:${payload.sub}:${payload.sid}`;
  const isActive = await this.redisCacheService.get(sessionKey);

  if (!isActive) {
    throw new UnauthorizedException('Session has been revoked or expired');
  }
```

Esto permite **revocar sesiones inmediatamente** sin esperar a que expire el JWT — algo imposible con JWT puramente stateless.

### 5.2 Estructura de Datos en Redis

| Clave Redis | Tipo | Contenido | TTL |
|---|---|---|---|
| `easy-point:session_metadata:{userId}:{sid}` | String (JSON) | IP, userAgent, createdAt, expiresAt | = refreshTokenTTL |
| `easy-point:user_sessions:{userId}` | Set | Lista de `sid` activos del usuario | Sin TTL (limpieza automática) |
| `easy-point:otp:{intent}:{email}` | String | Hash Argon2 del OTP | 2 min (prod) / 15 min (dev) |
| `easy-point:otp:cooldown:{email}` | String | `"locked"` | 60 segundos |
| `easy-point:otp:hourly_count:{email}` | String (int) | Contador de solicitudes | 1 hora |
| `easy-point:otp:verify_attempts:{intent}:{email}` | String (int) | Intentos fallidos | 15 minutos |
| `easy-point:ratelimit:{scope}:{windowId}` | String (int) | Contador de requests en ventana | windowMs |
| `easy-point:role_dirty:{roleId}` | String (timestamp ms) | Marca de cambio de permisos | 24 horas |

### 5.3 Gestión de Sesiones por el Usuario

El usuario puede:

| Operación | Endpoint | Descripción |
|---|---|---|
| Ver sesiones activas | `GET /auth/sessions` | Lista todos los dispositivos con IP y User-Agent |
| Cerrar sesión actual | `POST /auth/logout` | Elimina sesión Redis + refresh token DB + limpia cookies |
| Cerrar todas las sesiones | `POST /auth/logout-all` | Revoca TODAS las sesiones de todos los dispositivos |
| Terminar sesión específica | `DELETE /auth/sessions/:sid` | Mata una sesión en otro dispositivo |

```typescript
async killSession(userId: string, sessionIdToKill: string) {
  // 1. Eliminar metadata de sesión
  await this.redisCacheService.delete(`session_metadata:${userId}:${sessionIdToKill}`);
  // 2. Eliminar del set de sesiones activas
  await this.redisCacheService.srem(`user_sessions:${userId}`, sessionIdToKill);

  // 3. Auditar el evento como CRÍTICO
  this.auditService.log({
    action: AuditAction.SESSION_KILL,
    severity: AuditSeverity.CRITICAL,
    ...
  });
}
```

---

## 6. Autorización — Sistema de Guardias por Capas

La autorización se implementa con **cuatro guardias independientes** que pueden combinarse por endpoint:

```
JwtAuthGuard → [RolesGuard] → [OrgRolesGuard] → [PermissionsGuard]
```

### 6.1 JwtAuthGuard — Autenticación Base

**Archivo:** `src/common/guards/jwt-auth.guard.ts`

Primera línea de defensa. Verifica que:
1. El token Bearer existe en el header `Authorization`
2. La firma JWT es válida (con el secret configurado)
3. La sesión está activa en Redis (no revocada)
4. Adjunta el payload al objeto `request.user`

### 6.2 RolesGuard — Roles Globales del Sistema

**Archivo:** `src/common/guards/roles.guard.ts`

Protege endpoints administrativos del sistema (superadmin). Verifica el campo `role` del JWT payload contra los roles globales de Prisma (`GlobalRole.ADMIN`, etc.).

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(GlobalRole.ADMIN)
async adminOnlyEndpoint() { ... }
```

### 6.3 OrgRolesGuard — Roles dentro de Organizaciones

**Archivo:** `src/common/guards/org-roles.guard.ts`

Verifica que el usuario pertenece a la organización del contexto actual y que tiene el rol organizacional requerido.

**Validaciones encadenadas:**
1. Usuario autenticado en el JWT
2. Global Admin → bypass total
3. `organizationId` resuelto en el contexto
4. La organización existe en DB
5. La organización está en estado `ACTIVE` y `isActive: true`
6. El usuario pertenece a esa organización (`OrganizationUser`)
7. El rol del usuario coincide con el requerido

```typescript
// Ejemplo de uso en controller
@UseGuards(JwtAuthGuard, OrgRolesGuard)
@OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
async sensitiveOrgOperation() { ... }
```

### 6.4 PermissionsGuard — Permisos Granulares

**Archivo:** `src/common/guards/permissions.guard.ts`

El guard más sofisticado. Implementa **RBAC (Role-Based Access Control)** granular a nivel de recurso + acción.

**Jerarquía de acceso:**

```
GlobalRole.ADMIN   →  Bypass total (Super Admin del sistema)
        │
        ▼
OWNER / ADMINISTRATOR (isSystemDefault)  →  Bypass total dentro de su org
        │
        ▼
Cualquier otro rol  →  Verificación de permisos en DB
```

**Flujo completo del guard:**

```typescript
// 1. Leer permisos requeridos del decorador @RequirePermission
const requiredKeys = this.reflector.getAllAndOverride<string[]>(REQUIRE_PERMISSION_KEY, [...]);

// 2. Bypass: Global Admin
if (user.role === GlobalRole.ADMIN) return true;

// 3. Cargar orgUser con rol e info de organización
const orgUser = await this.prisma.organizationUser.findUnique({ ... });

// 4. Validar organización activa
if (orgUser.organization.status !== OrganizationStatus.ACTIVE || !orgUser.organization.isActive) {
  throw new ForbiddenException('Esta organización está inactiva o suspendida');
}

// 5. Verificar que los MÓDULOS requeridos están habilitados para la org
const enabledModulesCount = await this.prisma.permission.count({
  where: {
    key: { in: requiredKeys },
    feature: { module: { organizationModules: { some: { organizationId } } } }
  }
});
if (enabledModulesCount < requiredKeys.length) throw new ForbiddenException(...);

// 6. Dirty flag check — ¿fueron modificados los permisos después de emitir el token?
const dirtyTimestamp = await this.redisCacheService.get<number>(`role_dirty:${orgUser.roleId}`);
if (dirtyTimestamp && dirtyTimestamp > tokenIssuedAtMs) {
  throw new UnauthorizedException('Tus permisos han sido modificados. Re-login requerido.');
}

// 7. Bypass: OWNER y ADMINISTRATOR (roles sistema)
if (orgUser.role.isSystemDefault && [Role.OWNER, Role.ADMINISTRATOR].includes(role)) return true;

// 8. Verificar permisos granulares en DB
const rolePermissions = await this.prisma.rolePermission.findMany({ ... });
// El usuario debe tener TODOS los permisos requeridos
```

**Uso en controllers:**

```typescript
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('sales:create')
async createSale() { ... }

@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('employees:view_salary', 'employees:read')  // Requiere AMBOS permisos
async getEmployeeSalary() { ... }
```

### 6.5 Dirty Flag — Invalidación Inmediata de Permisos

El **dirty flag** en Redis resuelve el problema clásico de JWT stateless: "¿Cómo sé que los permisos no cambiaron desde que emití el token?"

```
Admin cambia permisos del rol X
         │
         ▼
  Redis.set('role_dirty:{roleId}', Date.now(), TTL=24h)
         │
         ▼
  Próxima request del usuario con rol X
         │
         ▼
  PermissionsGuard lee dirty flag
         │
         ▼
  dirtyTimestamp > token.iat * 1000 ?
    ├─ SÍ → throw UnauthorizedException("Permisos modificados. Re-login requerido")
    └─ NO → continuar verificación normal
```

**Resultado:** Cualquier cambio de permisos surte efecto en la siguiente request, sin esperar a que expire el JWT.

---

## 7. Rate Limiting — Sistema Multi-Tier Basado en Redis

### 7.1 Arquitectura Multi-Tier

**Archivo:** `src/common/ratelimit/`

El sistema implementa **5 tiers de rate limiting** independientes, almacenados en Redis mediante el algoritmo de **ventana fija (Fixed Window Counter)**:

```typescript
// RedisRateLimiterService — Algoritmo Fixed Window
async allow(key: string): Promise<{ allowed: boolean; info: LimitInfo }> {
  const now = Date.now();
  const windowId = Math.floor(now / this.config.windowMs); // ID de ventana actual
  const windowKey = `ratelimit:${key}:${windowId}`;

  const count = await this.redisClient.incr(windowKey);  // Atómico — sin race conditions

  if (count === 1) {
    await this.redisClient.pexpire(windowKey, this.config.windowMs); // Auto-expirar ventana
  }
  ...
}
```

El `INCR` de Redis es atómico, eliminando race conditions en entornos multi-instancia.

### 7.2 Configuración de Tiers

| Tier | Sujeto | Solicitudes | Ventana | Escenario |
|---|---|---|---|---|
| **Global** | IP + Ruta | 10,000 | 1 minuto | Protección global contra DDoS masivo |
| **strictIp** | IP + Ruta | 5 | 1 hora | Escrituras anónimas (registro, etc.) |
| **moderateIp** | IP + Ruta | 100 | 1 minuto | Lecturas anónimas / rutas de org |
| **readOps** | UserID + Ruta | 300 | 1 minuto | Operaciones de lectura autenticadas |
| **writeOps** | UserID + Ruta | 30 | 1 minuto | Operaciones de escritura autenticadas |

### 7.3 Lógica de Selección de Tier

```typescript
private resolveScopedLimiter(request: RequestWithUser): RateLimiter | null {
  const routeScope = this.getRouteScope(request);

  // Rutas de organización → moderateIp
  if (routeScope.startsWith('organizations')) return this.rateLimitersService.moderateIp;

  // Operaciones de inventario intensivas → moderateIp siempre
  if (routeScope.startsWith('supply-stock-entries') ||
      routeScope.startsWith('productions')) return this.rateLimitersService.moderateIp;

  if (this.hasAuthenticatedUser(request)) {
    return this.isReadOperation(request)
      ? this.rateLimitersService.readOps   // GET/HEAD → 300 req/min
      : this.rateLimitersService.writeOps; // POST/PUT/DELETE → 30 req/min
  }

  // Usuarios anónimos
  return this.isReadOperation(request)
    ? this.rateLimitersService.moderateIp  // 100 req/min
    : this.rateLimitersService.strictIp;   // 5 req/hora ← ESTRICTO
}
```

### 7.4 Headers de Rate Limit en Respuestas

Cada respuesta incluye headers estándar de rate limit:

```
X-RateLimit-Limit:     30
X-RateLimit-Remaining: 28
X-RateLimit-Reset:     2026-06-23T20:00:00.000Z
Retry-After:           45
```

### 7.5 Claves de Rate Limit

- **Autenticado:** `ratelimit:write-ops:{userId}:{routeScope}:{windowId}`
- **Anónimo:** `ratelimit:strict-ip:{clientIp}:{routeScope}:{windowId}`
- **Global:** `ratelimit:global:{clientIp}:{routeScope}:{windowId}`

### 7.6 Dependencia de `AuthContextMiddleware`

`RateLimitMiddleware` corre **antes** que cualquier guard (ver §3), así que `resolveScopedLimiter()` depende de que `request.user` ya esté poblado para distinguir tráfico autenticado de anónimo. Eso lo hace `AuthContextMiddleware` (§3.6), que corre justo antes en la cadena. Sin él, todo el tráfico —incluso de usuarios logueados— cae en los tiers anónimos (`moderateIp`/`strictIp`), y las escrituras autenticadas quedarían limitadas a **5 req/hora** en vez de 30 req/min.

**Antes de activar `RATE_LIMIT_ENABLED=true` en producción:** confirmar en un entorno de pruebas que un usuario autenticado efectivamente recibe el tier `write-ops`/`readOps` y no `strictIp`/`moderateIp` — es la forma más directa de verificar que el contexto de usuario está llegando correctamente al middleware.

---

## 8. Aislamiento Multi-Tenant (Tenant Isolation)

### 8.1 Principio de Diseño

Cada organización en Easy Point es un **tenant completamente aislado**. Ningún usuario puede acceder a los datos de otra organización, incluso si tiene el mismo rol.

El aislamiento se aplica en **dos capas independientes**, y esa independencia es deliberada: si una falla, la otra sigue conteniendo el daño.

| Capa | Dónde | Qué garantiza | Qué NO cubre |
|---|---|---|---|
| **Scoping en el ORM** | Extensión Prisma en `prisma.service.ts` | Inyecta `organizationId` por defecto en `where` y en `data` para los 29 modelos tenant-aware | Cualquier cosa que no pase por Prisma; olvidos en modelos no listados |
| **Row-Level Security** | Políticas en Postgres (migración `enable_rls`) | La base de datos **rechaza** filas de otra organización, aunque la query venga sin filtro por un bug | Tablas exentas a propósito (§8.7) |

**Ambas listas se mantienen sincronizadas por un test** (`src/prisma/tenant-models.spec.ts`): si alguien añade un modelo con `organizationId` y no lo clasifica ni le crea política RLS, la suite falla. Un modelo nuevo sin aislamiento es una fuga silenciosa entre organizaciones; el objetivo es que ese error rompa CI, no producción.

### 8.1.1 Row-Level Security — la garantía dura

La app se conecta como `easypoint_app`, un rol **sin `BYPASSRLS` y que no es dueño de las tablas** (Postgres exime al owner de las políticas — conectarse como owner haría que RLS no hiciera absolutamente nada). Las migraciones siguen corriendo como el owner vía `DIRECT_URL`, que sí está exento a propósito.

```sql
CREATE POLICY tenant_isolation ON "sales"
  USING (
    "organizationId" = current_setting('app.current_org_id', TRUE)
    OR current_setting('app.bypass_tenant', TRUE) = 'on'
  )
  WITH CHECK ( /* mismas condiciones */ );
```

- `current_setting(..., TRUE)` devuelve `NULL` si la variable no está fijada → la comparación es `NULL` → **cero filas**. **Falla cerrado**: una query sin contexto de tenant no ve nada, en lugar de verlo todo.
- `WITH CHECK` impide además **escribir** filas de otra organización, no solo leerlas.

### 8.1.2 Propagación del tenant (por transacción, nunca por sesión)

El tenant se publica a Postgres con `set_config(..., TRUE)` — el tercer parámetro lo hace **local a la transacción**. Esto es crítico: un `SET` normal persistiría en la conexión del pool y la siguiente request que la reutilizara heredaría el tenant anterior, que es exactamente la fuga que RLS pretende evitar.

`PrismaService` expone dos helpers, y la distinción entre ellos importa:

```typescript
// Operaciones de negocio normales: publica el tenant del contexto actual.
await this.prisma.$tenantTransaction(async (tx) => { /* ... */ });

// Control plane que legítimamente cruza organizaciones.
await this.prisma.$systemTransaction(async (tx) => { /* ... */ });
```

Las queries emitidas a través de `tx` **no pasan por la extensión de Prisma**, así que sin estos helpers correrían sin la variable fijada y RLS devolvería cero filas. Todas las transacciones interactivas del proyecto usan uno de los dos; no queda ninguna `$transaction(async ...)` cruda.

`$systemTransaction` está reservado a flujos server-side de confianza y **no es alcanzable desde una cabecera HTTP**:

- **Creación de organizaciones** (`organizations.repository.ts`) — bootstrapea una organización nueva cuyo id no puede coincidir con el tenant del que la crea. Sin bypass, el `role.findMany` posterior devolvería cero filas y los permisos por defecto no se cablearían, en silencio.
- **Cron de suscripciones** (`subscription-lifecycle.service.ts`) — recorre organizaciones sin contexto de request.
- **Registro / aceptación de invitación** (`auth.service.ts`) — el usuario todavía no pertenece a la organización.

### 8.2 AsyncLocalStorage — Context Propagation

**Archivo:** `src/common/context/tenant.context.ts`

```typescript
export const tenantContextStorage = new AsyncLocalStorage<TenantContext>();

export interface TenantContext {
  organizationId: string | null;
  bypassTenant?: boolean;
  requestId?: string;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  impersonatedBy?: string;
}
```

`AsyncLocalStorage` es el equivalente a thread-local storage en Node.js. Cada request tiene su propio contexto aislado que NO se comparte entre requests concurrentes.

### 8.3 Flujo de Resolución de Tenant

```
TenantMiddleware → AsyncLocalStorage.run(state, callback)
                                    │
                    ┌───────────────┘
                    ▼
         Toda la cadena del request
         (Guards, Services, Repos) ejecuta
         DENTRO de este contexto
                    │
                    ▼
         getTenantId() → organizationId aislado
```

### 8.4 Validación en los Guards

Tanto `OrgRolesGuard` como `PermissionsGuard` validan que el `organizationId` del contexto coincide con el usuario antes de cualquier operación de DB:

```typescript
const organizationId = getTenantId();
if (!organizationId) {
  throw new ForbiddenException('Contexto de organización no encontrado');
}
// Todas las queries van filtradas por organizationId
const orgUser = await this.prisma.organizationUser.findUnique({
  where: { userId_organizationId: { userId, organizationId } },
});
```

### 8.5 Tablas exentas a propósito

Cuatro tablas con `organizationId` quedan **fuera** del scoping automático y de RLS, porque hay flujos legítimos que las leen entre organizaciones. La exención es explícita y está declarada en `TENANT_EXEMPT_MODELS`, no es un olvido:

| Tabla | Por qué |
|---|---|
| `invitations` | Se consulta por su token único durante la aceptación, cuando el invitado **todavía no pertenece** a la organización y no hay contexto de tenant. El token es la credencial. |
| `subscriptions` · `invoices` | Los lee el dashboard de admin global y el cron de suscripciones, por diseño entre organizaciones. |
| `organization_modules` | Lo resuelve `PermissionsGuard` y lo asignan los admins globales. |

Estas cuatro siguen filtrando por `organizationId` **explícitamente** en sus servicios. La contrapartida es consciente: en ellas la corrección depende del código, no de la base de datos, así que los cambios en esos módulos merecen más escrutinio en revisión.

### 8.6 Separación física por tenant (preparada, no activada)

`Organization.databaseId` (por defecto `"default"`) es el punto de enganche para mover una organización concreta a una base de datos dedicada. Hoy **todas** apuntan a la base compartida y `DatabaseRegistryService` resuelve siempre la misma conexión — sin cambio de comportamiento ni costo.

Existe porque separar bases de datos *por defecto* sería caro y contraproducente a esta escala (cada `PrismaClient` abre su propio pool: 100 tenants ≈ 500 conexiones ≈ 2.5-5 GB de RAM solo en conexiones ociosas, además de migraciones y backups multiplicados por N). El aislamiento fuerte lo da RLS; este seam existe para el caso en que un cliente exija aislamiento físico por contrato o regulación, y entonces se le asigna un `databaseId` propio sin tocar el resto del sistema.

### 8.7 Validación de Estado de Organización

Los guards también verifican que la organización esté activa antes de permitir cualquier operación:

```typescript
if (
  orgUser.organization.status !== OrganizationStatus.ACTIVE ||
  !orgUser.organization.isActive
) {
  throw new ForbiddenException('Esta organización está inactiva o suspendida');
}
```

---

## 9. Sistema de Auditoría (Audit Trail)

### 9.1 Arquitectura del Sistema de Auditoría

```
Request HTTP
     │
     ▼
AuditInterceptor (@Audit decorator)
     │ o
AuditService.log() desde Service Layer
     │
     ▼ fire-and-forget (no bloquea el request)
EventEmitter2.emit('audit.log', event)
     │
     ▼
AuditConsumer.handleAuditEvent()
     │
     ├──► AuditRepository.create() → PostgreSQL (persistencia)
     └──► process.stdout.write(JSON) → stdout estructurado (Loki/Datadog/OpenSearch)
```

El diseño **fire-and-forget** garantiza que el audit nunca ralentiza el request del usuario. Si el audit falla, el error se registra en logs pero NO afecta la respuesta.

### 9.2 Sanitización de Datos Sensibles

**Archivo:** `src/infraestructure/audit/audit.sanitizer.ts`

Antes de persistir cualquier snapshot (`before`/`after`), todos los datos pasan por el sanitizador:

```typescript
const SENSITIVE_KEYS = new Set([
  // Auth credentials
  'password', 'passwordHash', 'hashedPassword', 'newPassword', 'oldPassword',

  // Tokens
  'token', 'accessToken', 'refreshToken', 'idToken', 'bearerToken', 'jwtToken',

  // Secrets / Keys
  'secret', 'clientSecret', 'apiKey', 'apiSecret', 'privateKey', 'signingKey',

  // Session / Auth headers
  'authorization', 'cookie', 'setCookie', 'xCsrfToken', 'xAuthToken',

  // OTP / verification
  'otp', 'verificationCode', 'resetCode', 'pinCode',

  // Datos personales sensibles
  'ssn', 'taxId', 'nationalId',
]);

const REDACTED = '[REDACTED]';
```

El sanitizador:
- **Recursivo:** Inspecciona objetos anidados hasta 10 niveles de profundidad
- **Inmutable:** No modifica el objeto original, retorna una copia limpia
- **Case-insensitive:** Normaliza las claves antes de comparar (detecta `password`, `PASSWORD`, `Password`)
- **Truncado:** Strings largos (>2000 chars) se truncan con `…[TRUNCATED]` para evitar payload bloat en DB

### 9.3 Acciones Auditadas

| Acción | Severidad | Descripción |
|---|---|---|
| `LOGIN` | LOW | Inicio de sesión exitoso |
| `LOGOUT` | LOW | Cierre de sesión |
| `LOGIN_FAILED` | **CRITICAL** | Intento de login fallido (OTP incorrecto, intentos excedidos) |
| `PASSWORD_CHANGE` | **CRITICAL** | Cambio de contraseña/credencial |
| `SESSION_KILL` | **CRITICAL** | Terminación forzada de sesión |
| `API_KEY_CHANGE` | **CRITICAL** | Cambio de API key |
| `CREATE` | MEDIUM | Creación de cualquier recurso |
| `UPDATE` | MEDIUM | Modificación de recurso |
| `DELETE` | HIGH | Eliminación de recurso |
| `CANCEL` | HIGH | Cancelación de operación |
| `ROLE_CHANGE` | HIGH | Cambio de rol de usuario |
| `PERMISSION_CHANGE` | HIGH | Cambio de permisos de rol |
| `TENANT_CONFIG_CHANGE` | HIGH | Cambio de configuración de organización |
| `RESTORE` | MEDIUM | Restauración de entidad |
| `EXPORT` | MEDIUM | Exportación de datos |

### 9.4 Payload del Evento de Auditoría

```typescript
interface AuditLogEvent {
  tenantId:      string;         // Organización afectada
  userId?:       string;         // Usuario que realizó la acción
  impersonatedBy?: string;       // Reservado para impersonación futura
  action:        AuditAction;    // Tipo de acción
  resourceType:  string;         // 'Client', 'Sale', 'Session', etc.
  resourceId?:   string;         // ID del recurso afectado
  before?:       Record<string, unknown>; // Estado previo (sanitizado)
  after?:        Record<string, unknown>; // Estado posterior (sanitizado)
  changedFields?: ChangedFieldsMap;       // Diff automático campo por campo
  ipAddress?:    string;         // IP del cliente
  userAgent?:    string;         // User-Agent
  requestId?:    string;         // ID único del request (trazabilidad)
  sessionId?:    string;         // ID de sesión
  severity:      AuditSeverity;  // LOW | MEDIUM | HIGH | CRITICAL
}
```

### 9.5 Diff Automático de Cambios

```typescript
// Ejemplo de changedFields automático en UPDATE
{
  "creditLimit": { "before": "500.00", "after": "1000.00" },
  "name":        { "before": "Acme",   "after": "Acme Corp" }
}
```

### 9.6 Retención y Purga Automática

```typescript
// AuditConsumer — job diario a medianoche
@OnEvent('cron.daily_midnight', { async: true })
async handleDailyPurge(): Promise<void> {
  const retentionDays = process.env['AUDIT_LOG_RETENTION_DAYS'] ?? 30;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  await this.auditRepository.deleteOlderThan(cutoff);
}
```

La retención por defecto es de **30 días**, configurable mediante la variable de entorno `AUDIT_LOG_RETENTION_DAYS`.

### 9.7 Decorador `@Audit()` para Controllers

```typescript
// Uso declarativo en controllers
@Patch(':id')
@Audit({ action: AuditAction.UPDATE, resource: 'Client', captureBeforeState: true })
@UseInterceptors(AuditInterceptor)
async update(@Param('id') id: string, @Body() dto: UpdateClientDto) { ... }
```

---

## 10. Protección contra Ataques Conocidos

### 10.1 XSS (Cross-Site Scripting)

| Control | Implementación |
|---|---|
| Tokens en HttpOnly cookies | `httpOnly: true` en `setAuthCookies()` |
| Headers de seguridad HTTP | `helmet()` (CSP, X-XSS-Protection, etc.) |
| Validación de input | `ValidationPipe` con `whitelist: true` |
| Sanitización de outputs | Esquemas de respuesta tipados con DTOs |

### 10.2 CSRF (Cross-Site Request Forgery)

| Control | Implementación |
|---|---|
| SameSite cookies | `sameSite: 'lax'` en ambas cookies |
| CORS configurado | `app.enableCors()` — en producción debe restringirse a dominios conocidos |
| Double Submit Pattern | El refresh token está en cookie HttpOnly, no accesible para scripts maliciosos |

### 10.3 SQL Injection

| Control | Implementación |
|---|---|
| Prisma ORM | Todas las queries son parametrizadas automáticamente — sin SQL crudo |
| Typed DTOs | Los datos de entrada son validados y tipados antes de llegar al repository |
| Query builder tipado | El ORM convierte los objetos TypeScript a SQL parametrizado |

### 10.4 DDoS / Abuso de API

| Control | Implementación |
|---|---|
| Rate limit global | 10,000 req/min por IP (configurable) |
| Rate limit por usuario | 300 reads / 30 writes por minuto |
| Rate limit estricto anónimo | 5 escrituras por hora desde IP |
| Payload limit | 1 MB máximo por request |
| OTP cooldown | 60 segundos entre solicitudes de OTP |
| Bloqueo por intentos | 3 intentos fallidos → 15 min de bloqueo |

### 10.5 Brute Force en Autenticación

| Control | Implementación |
|---|---|
| OTP de tiempo limitado | 2 min en prod / 15 min en dev |
| Bloqueo por intentos | Max 3 intentos de verificación |
| Cooldown entre OTPs | 60 segundos mínimo entre solicitudes |
| Límite horario | Máximo 3 OTPs por email por hora |
| Hash con Argon2 | Imposible precomputar hash del OTP |
| CSPRNG | OTP generado con `crypto.randomInt()` |

### 10.6 Session Hijacking / Token Theft

| Control | Implementación |
|---|---|
| HttpOnly cookies | JS no puede leer los tokens |
| Secure flag (producción) | Solo HTTPS |
| Session ID en Redis | Revocación instantánea posible |
| Refresh token rotation | Token robado detectado en siguiente uso |
| Hash en DB | El token nunca se almacena en texto plano |
| IP + User-Agent en sesión | Detección de anomalías posible |

### 10.7 Information Disclosure

| Control | Implementación |
|---|---|
| Global Exception Filter | Stack traces y errores internos nunca llegan al cliente |
| TraceID en errores | El cliente recibe solo un ID de traza, sin detalles técnicos |
| Sanitizador de audit | Datos sensibles redactados antes de persistir |
| Mensajes de error genéricos | "Invalid or expired token" en lugar de detalles específicos |

### 10.8 Privilege Escalation

| Control | Implementación |
|---|---|
| Jerarquía de guards | Capas independientes — un fallo no bypasea las demás |
| Dirty flag en Redis | Cambios de permisos surten efecto de inmediato |
| Validación de org activa | Org suspendida = acceso denegado incluso con token válido |
| Módulos por org | Un permiso no activo en la org bloquea el acceso |

---

## 11. Gestión de Errores y Trazabilidad

### 11.1 GlobalExceptionFilter

**Archivo:** `src/common/filters/global-exception.filter.ts`

```typescript
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const traceId = crypto.randomUUID().split('-')[0]; // ID corto de traza

    // AppError (errores de dominio) → mensaje de negocio al cliente
    if (exception instanceof AppError) {
      return response.status(exception.httpStatus).json({
        success: false,
        error: { code: exception.errorCode, message: exception.message, details: { traceId } }
      });
    }

    // HttpException (validaciones, auth) → mensaje controlado
    if (exception instanceof HttpException) {
      return response.status(status).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: ..., details: { traceId } }
      });
    }

    // Cualquier error inesperado → mensaje genérico + log completo en servidor
    this.logger.error(`[Unhandled Exception] [TraceID: ${traceId}] ${method} ${url}`, stack);
    return response.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error occurred.', details: { traceId } }
    });
  }
}
```

**Principios de seguridad:**
- **Fail-safe:** Ningún error no controlado expone información técnica al cliente
- **TraceID único:** Permite correlacionar el error en logs sin revelar detalles al usuario
- **Tres niveles:** Domain errors, HTTP errors, Unhandled errors — tratados de forma diferente

### 11.2 AppError — Errores de Dominio Seguros

```typescript
export abstract class AppError extends Error {
  public readonly message: string;
  public readonly httpStatus: number;
  public readonly errorCode: string;         // Código de negocio (no código de stack)
  public readonly details?: Record<string, any>;
}
```

Los errores de dominio incluyen un `errorCode` de negocio sin exponer detalles del stack o la base de datos.

---

## 12. Seguridad en la Capa de Infraestructura

### 12.1 Redis — Configuración Segura

**Archivo:** `src/infraestructure/redis/redis.module.ts`

```typescript
const options: RedisOptions = {
  host:      redisConfig.host,
  port:      redisConfig.port,
  password:  redisConfig.password,      // ← Autenticación obligatoria
  db:        redisConfig.db,
  keyPrefix: `${redisConfig.keyPrefix}:`, // ← Namespace para aislamiento
  lazyConnect:          true,            // ← Conexión bajo demanda
  maxRetriesPerRequest: null,
  enableReadyCheck:     true,
};
```

- **Password requerida:** Redis no acepta conexiones sin autenticación
- **KeyPrefix:** Todas las claves tienen el prefijo `easy-point:` — aislamiento de otros procesos
- **Graceful shutdown:** `onApplicationShutdown()` cierra la conexión limpiamente con `redisClient.quit()`
- **Error handling:** Errores de conexión se loguean sin crashear la aplicación

### 12.2 Supabase Storage — URLs Presignadas

El acceso a archivos (logos de organizaciones) usa URLs presignadas de tiempo limitado:

```typescript
// En auth.service.ts getProfile()
if (logoUrl) {
  logoUrl = await this.storageService.getPresignedUrl(logoUrl);
}
```

Los usuarios nunca reciben la URL directa del bucket S3 — solo un link temporal con expiración.

### 12.3 Variables de Entorno — Configuración Tipada y Validación al Arranque

**Archivo:** `src/common/config/config.ts`

Toda la configuración se accede a través del sistema tipado de `@nestjs/config` con el patrón `registerAs`. Nunca se accede directamente a `process.env` en servicios de negocio. Esto garantiza:
- Validación de tipos en tiempo de compilación
- Inyección de dependencias testeables

**Fail-fast en el arranque:** `validateConfig()` corre antes de que la app termine de inicializar y lanza un único error legible listando *todo* lo que falta, en vez de dejar que la app arranque con un valor inseguro o falle más tarde con un stack trace confuso a mitad de un request:

```typescript
function validateConfig(): void {
  const missing: string[] = [];
  // JWT_SECRET / JWT_REFRESH_SECRET: obligatorios, ≥32 caracteres, distintos entre sí
  // DATABASE_URL / DIRECT_URL: obligatorios siempre
  // En producción, además: CORS_ORIGINS, SMTP_*, S3_*, REDIS_PASSWORD,
  // y que API_BASE_URL/FRONTEND_URL usen https://
  if (missing.length > 0) {
    throw new Error(`[Config] Cannot start application — missing or invalid environment variables:\n...`);
  }
}
```

`JWT_SECRET` y `JWT_REFRESH_SECRET` **no tienen fallback** — antes existía un valor hardcodeado (`'fallback_secreto_desarrollo_temporal'`) usado tanto en `config.ts` como en `jwt-auth.guard.ts` si la variable de entorno no estaba definida, lo que permitía forjar tokens válidos con solo leer el código fuente. Ambos guards y servicios ahora reciben el secreto exclusivamente vía `ConfigType<typeof appConfig>` inyectado — no hay lectura directa de `process.env.JWT_SECRET` en ningún punto de autenticación.

---

## 13. Seguridad a Nivel de Datos y Prisma

### 13.1 Multi-tenancy en Queries

El filtrado por `organizationId` ocurre en tres niveles superpuestos (detalle completo en §8):

```typescript
// 1. Explícito en el repository — sigue siendo la forma idiomática
const sales = await this.prisma.sale.findMany({
  where: { organizationId: getTenantId() },
});

// 2. Por defecto en el ORM — si el repository lo omite, la extensión de
//    Prisma lo inyecta a partir del contexto (AsyncLocalStorage)
const sales = await this.prisma.sale.findMany(); // ← acotado igualmente

// 3. Impuesto por Postgres — aunque un bug se salte 1 y 2, la política RLS
//    no devuelve filas de otra organización
```

La extensión aplica el `organizationId` **solo como valor por defecto**: si el llamador especifica uno explícitamente, se respeta en lugar de sobrescribirlo. Esto importa para flujos que operan legítimamente sobre otra organización (el bootstrap de una organización recién creada, por ejemplo); sobrescribir en silencio redirigiría esas escrituras a la organización equivocada. Lo que hace que un `organizationId` ajeno sea *no autorizado* es RLS, no el ORM.

### 13.2 Prisma como Capa de Seguridad

- **No raw queries:** Todo el acceso a DB se hace a través del cliente Prisma tipado
- **Transacciones:** Operaciones críticas (registro + aceptar invitación) se ejecutan en transacciones ACID
- **Soft deletes:** Los registros no se eliminan físicamente — solo se marcan como inactivos

### 13.3 Audit Log — Datos Inmutables

La tabla `AuditLog` en PostgreSQL es de **solo inserción** desde la API — el código solo expone:
- `create()`: Insertar nuevos registros
- `findMany()`: Lectura paginada y filtrada
- `deleteOlderThan()`: Purga programada (solo por cron job interno, no por API)

No existe ningún endpoint público que permita modificar o eliminar registros de auditoría.

---

## 14. Seguridad en Contenedores y DevOps

Dos imágenes separadas: `Dockerfile.dev` (desarrollo, hot-reload) y `Dockerfile` (producción, multi-stage). Ver [`DEPLOYMENT.md`](./DEPLOYMENT.md) para el procedimiento operativo completo.

### 14.1 Dockerfile de Producción — Multi-Stage, No-Root

```dockerfile
FROM node:22-alpine AS deps    # instala TODAS las dependencias (necesarias para compilar)
FROM node:22-alpine AS build   # compila TS + `prisma generate`
FROM node:22-alpine AS prod-deps  # solo dependencias de producción, natives recompilados
FROM node:22-alpine AS runner  # imagen final: sin devDependencies, sin toolchain de compilación

USER node   # ← corre como usuario no-root (antes corría como root)

# Node 22 trae fetch global: el healthcheck no necesita curl en la imagen
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/v1/health')..."
```

- **Multi-stage:** la imagen final no contiene `python3`/`make`/`g++` (toolchain de compilación de nativos), ni devDependencies (`ts-node`, `jest`) — reduce superficie de ataque y tamaño de imagen.
- **`prisma generate` en build-time**, no en runtime — antes el `CMD` del Dockerfile de desarrollo ejecutaba `prisma generate` cada vez que arrancaba el contenedor (aceptable en dev, pero no en un contenedor productivo inmutable).
- **Sin el CLI de Prisma en runtime.** La etapa `prod-deps` copia el cliente ya generado desde `build` (`@prisma/client` + `.prisma`) y elimina explícitamente el CLI, `@prisma/engines`, `studio-core`, `@prisma/dev` y `pglite`. No son alcanzables en ejecución —`@prisma/client` solo depende de `@prisma/client-runtime-utils`, y las queries van por `@prisma/adapter-pg`— y suman ~180 MB de herramientas de desarrollo (incluido Prisma Studio y un Postgres embebido). **Las migraciones se ejecutan por el servicio `migrate` del compose**, que usa la etapa `build`.
- **`--config.node-linker=hoisted`** en cada `pnpm install`. Sin esto, el cliente de Prisma generado queda dentro del store virtual de pnpm en una ruta con hash (`node_modules/.pnpm/@prisma+client@<hash>/…`), no direccionable de forma estable por `COPY --from`. Con el linker plano, `prod-deps` copia el cliente ya generado desde `build` en una ruta fija en vez de tener que reinstalar el CLI solo para regenerarlo.
- **Sin `curl`:** el healthcheck usa el `fetch` global de Node 22, evitando un binario extra en la imagen.
- **Non-root:** corre como el usuario `node` preexistente en la imagen base, no como `root`.
- **`tini`** como PID 1, para que las señales de shutdown (`SIGTERM`) se propaguen correctamente al proceso Node y `app.enableShutdownHooks()` (ver `main.ts`) pueda cerrar Redis limpiamente.
- **Tamaño resultante:** 975 MB → **560 MB reales / ~127 MB comprimida**. Detalle del desglose y de una trampa de medición en Docker Desktop/Windows (containerd snapshotter reporta `docker images` de forma inconsistente) en `PROJECT_GLOBAL_CONFIG.md §4.3`.

### 14.2 Docker Compose — Producción sin Puertos Publicados

En `compose.prod.yaml`, `easy-point-api`, `postgres` y `social-redis` **no publican ningún puerto al host** (`ports: !reset []`, sobrescribiendo explícitamente los mappings de `127.0.0.1:PORT` usados en desarrollo). Todo el tráfico entrante pasa por `caddy` (TLS termination + reverse proxy), que es el único servicio con puertos publicados (`80`/`443`):

```yaml
easy-point-api:
  ports: !reset []       # sin publicar — solo alcanzable dentro de easy-point-net
postgres:
  ports: !reset []       # ídem
caddy:
  ports:
    - "80:80"
    - "443:443"
```

- `!reset []` es el tag de la especificación Compose para limpiar explícitamente una lista heredada del archivo base, en vez de depender de semántica de fusión implícita.
- En desarrollo, `postgres`, `social-redis` y `redis-commander` publican solo en `127.0.0.1` (nunca en `0.0.0.0`) — anteriormente Redis se publicaba en todas las interfaces.
- Los servicios de un solo uso (`postgres-backup`, `migrate`) reciben únicamente las variables de entorno que necesitan (credenciales de DB + backup), no el `.env` completo — así un contenedor comprometido en ese perfil no expone `JWT_SECRET`/`SMTP_PASSWORD`/etc.

### 14.3 .dockerignore y .gitignore

El `.dockerignore` excluye del contexto de build:
- `node_modules/`, `dist/`, `coverage/`
- `.env` y `.env.*` (variables de entorno no van en la imagen; se inyectan vía `env_file`/`environment` en runtime)
- `docs/`, `test/`, archivos `*.md`, `.claude/`

---

## 15. Controles de Validación de Entrada

### 15.1 ValidationPipe Global

```typescript
// src/main.ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,            // ← Elimina automáticamente propiedades no declaradas en el DTO
    forbidNonWhitelisted: true, // ← Rechaza el request si contiene propiedades desconocidas (HTTP 400)
    transform: true,            // ← Transforma y coerce tipos automáticamente
    transformOptions: {
      enableImplicitConversion: true,
    },
  }),
);
```

**`whitelist: true` + `forbidNonWhitelisted: true`** es la combinación más segura:
- `whitelist` solo elimina los campos extra → el request se procesa igual pero sin esos campos (potencialmente peligroso)
- `forbidNonWhitelisted` **rechaza el request completo** si hay campos no esperados → previene inyección de propiedades

### 15.2 Helmet — Headers de Seguridad HTTP

```typescript
// src/main.ts
app.use(helmet());
```

Helmet configura automáticamente los siguientes headers:

| Header | Propósito |
|---|---|
| `Content-Security-Policy` | Previene XSS y clickjacking |
| `X-Frame-Options` | Previene embedding en iframes (clickjacking) |
| `X-Content-Type-Options` | Previene MIME-sniffing |
| `Referrer-Policy` | Controla información de Referer |
| `X-XSS-Protection` | Activa filtro XSS del browser (legacy) |
| `Strict-Transport-Security` | Fuerza HTTPS (HSTS) |
| `X-DNS-Prefetch-Control` | Controla prefetch de DNS |

### 15.3 API Versioning

```typescript
app.enableVersioning({
  type: VersioningType.URI,
  defaultVersion: '1',
});
```

El versionado en URI (`/api/v1/`) permite evolucionar la API sin romper contratos existentes y facilita la deprecación controlada de endpoints.

---

## 16. Recomendaciones Adicionales de Seguridad

### ✅ Resueltas (Julio 2026)

Las siguientes cuatro recomendaciones de Alta Prioridad de esta sección ya están implementadas:

| # | Recomendación | Dónde |
|---|---|---|
| 1 | CORS restringido por whitelist en vez de `origin: '*'` | `main.ts` — lee `CORS_ORIGINS` de `config.ts`, obligatorio en producción |
| 2 | `JWT_SECRET`/`JWT_REFRESH_SECRET` sin fallback + validación al arranque | `config.ts` (`validateConfig()`), `jwt-auth.guard.ts` (inyecta config, ya no lee `process.env` directamente) |
| 3 | Contenedor de producción corre como usuario no-root | `Dockerfile` (`USER node`) |
| 4 | HTTPS enforced + HSTS | `Caddyfile` — TLS automático vía Let's Encrypt, header `Strict-Transport-Security` |

Además, en la misma pasada de hardening de deployment se resolvieron estos puntos que no estaban listados explícitamente en esta sección:

| Hallazgo | Dónde |
|---|---|
| `x-bypass-tenant` sin verificación de rol — cualquiera podía desactivar el filtro multi-tenant | `tenant.middleware.ts` — ahora exige `GlobalRole.ADMIN` (ver §3.4) |
| Rate limiting por usuario nunca funcionaba (`request.user` no existía en el middleware) | `auth-context.middleware.ts` nuevo (ver §3.6, §7.6) |
| Swagger/ReDoc expuestos siempre, incluso en producción | `main.ts` + `SWAGGER_ENABLED` en `config.ts` — deshabilitado por defecto en producción |
| `DevelopmentController` (OTP en texto plano, tokens de invitación) siempre registrado | `auth.module.ts` — el controller no se registra fuera de `NODE_ENV=development` |
| Sin `trust proxy` — IPs detrás de Caddy no se resolvían correctamente | `main.ts` — `app.set('trust proxy', ...)` vía `TRUST_PROXY` |
| `pnpm start:prod` no arrancaba (ruta de build incorrecta) | `package.json` — `node dist/src/main.js` |
| SMTP sin STARTTLS forzado | `mail.service.ts` — `requireTLS` cuando el puerto no es 465 |

El resto de esta sección se mantiene como registro histórico de la recomendación original, y como referencia de las prioridades restantes.

### 🔴 Alta Prioridad (histórico)

**1. Restringir CORS en Producción** — ✅ Resuelto, ver tabla arriba.

**2. Usar Secreto JWT desde Variables de Entorno Forzadas** — ✅ Resuelto, ver tabla arriba.

**3. Ejecutar como Non-Root en Docker** — ✅ Resuelto, ver tabla arriba.

**4. HTTPS Enforced en Producción** — ✅ Resuelto, ver tabla arriba.

### 🟡 Media Prioridad

**5. Implementar CSRF Token para Formularios**

Aunque `sameSite: 'lax'` mitiga la mayoría de ataques CSRF, para mayor seguridad en formularios sensibles se puede implementar el patrón Double Submit Cookie con un CSRF token explícito.

**6. Implementar Content Security Policy personalizada**

```typescript
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
  }),
);
```

**7. Alertas en Tiempo Real para Eventos Críticos**

Integrar con Slack/PagerDuty cuando `AuditSeverity.CRITICAL` se registra:

```typescript
// En AuditConsumer.handleAuditEvent()
if (event.severity === AuditSeverity.CRITICAL) {
  await this.alertService.notifySecurityTeam(event);
}
```

**8. Implementar IP Allowlist para Endpoints de Admin**

```typescript
@UseGuards(IpAllowlistGuard, JwtAuthGuard, RolesGuard)
@Roles(GlobalRole.ADMIN)
@Get('admin/dashboard')
```

### 🟢 Mejoras a Futuro

**9. Audit Log Inmutable con Firma Digital**

Firmar cada entrada de audit log con HMAC para detectar manipulaciones:

```typescript
const signature = crypto
  .createHmac('sha256', process.env.AUDIT_SIGNING_KEY)
  .update(JSON.stringify(auditData))
  .digest('hex');
```

**10. Implementar Refresh Token en Cookie Separada (`/auth/refresh` path)**

Usar `path: '/api/v1/auth/refresh'` para que el refresh token cookie solo se envíe al endpoint de renovación, reduciendo la ventana de exposición.

**11. Rate Limiting por User-Agent (Bot Detection)**

Agregar un tier de rate limiting adicional que detecte y bloquee patrones de User-Agent conocidos de bots de ataque.

**12. Expiración de Sesiones por Inactividad**

Implementar un sliding TTL en Redis para las sesiones: cada request activo extiende el TTL. Una sesión sin actividad por N horas expira automáticamente.

**13. Anomaly Detection en Login**

Si un token con IP registrada `192.168.1.1` hace una request desde `203.0.113.5`, emitir un evento de seguridad y forzar re-autenticación.

**14. Dependency Scanning Automatizado**

Integrar `pnpm audit` o Snyk en el pipeline de CI/CD para detección automática de vulnerabilidades en dependencias.

---

## 17. Tabla Resumen de Controles de Seguridad

| Control | Implementación | Protección |
|---|---|---|
| **Helmet** | `app.use(helmet())` | XSS, Clickjacking, MIME sniffing, HSTS |
| **CORS** | `app.enableCors()` | Cross-origin requests no autorizados |
| **ValidationPipe (whitelist)** | `whitelist: true, forbidNonWhitelisted: true` | Inyección de propiedades, payload inesperado |
| **Payload Limit** | `JsonBodyMiddleware (1MB)` | DoS por payload gigante |
| **Helmet** | `app.use(helmet())` | 15+ headers de seguridad HTTP |
| **HttpOnly Cookies** | `setAuthCookies()` | Robo de tokens por XSS |
| **Secure Cookies (prod)** | `secure: isProduction` | Interceptación en tránsito (MITM) |
| **SameSite Cookies** | `sameSite: 'lax'` | CSRF |
| **JWT + Redis** | `JwtAuthGuard` | Autenticación stateful revocable |
| **OTP + Argon2** | `AuthService.generateOtp()` | Fuerza bruta, precomputación de hash |
| **CSPRNG** | `crypto.randomInt()` | OTPs predecibles |
| **Refresh Token Rotation** | `AuthService.refreshToken()` | Token theft detection |
| **SHA-256 en DB** | `crypto.createHash('sha256')` | Tokens en texto plano en DB |
| **Rate Limit Multi-Tier** | `RateLimitMiddleware + Redis` | DDoS, brute force, abuso de API |
| **OTP Cooldown + Límites** | `AuthService.generateOtp()` | Flooding de emails OTP |
| **Tenant Isolation** | `TenantMiddleware + AsyncLocalStorage` | Cross-tenant data leakage |
| **Org Status Validation** | `OrgRolesGuard + PermissionsGuard` | Acceso con org suspendida |
| **Dirty Flag Redis** | `role_dirty:{roleId}` | Permisos desactualizados post-token |
| **RBAC Granular** | `PermissionsGuard + @RequirePermission` | Privilege escalation |
| **Audit Trail Completo** | `AuditService + AuditConsumer` | Trazabilidad de acciones |
| **Audit Sanitizer** | `sanitizePayload()` | Datos sensibles en logs |
| **Global Exception Filter** | `GlobalExceptionFilter` | Information disclosure en errores |
| **TraceID en errores** | `crypto.randomUUID()` | Correlación sin revelar stack |
| **Prisma ORM** | Queries parametrizadas | SQL Injection |
| **Presigned URLs S3** | `StorageService.getPresignedUrl()` | Acceso directo a buckets S3 |
| **Redis Auth** | `password: redisConfig.password` | Acceso no autorizado a Redis |
| **Network Isolation Docker** | `easy-point-net bridge` | Comunicación inter-servicios no controlada |
| **Redis Commander localhost-only** | `127.0.0.1:8081` | Redis UI expuesto públicamente |
| **API Versioning** | `VersioningType.URI` | Breaking changes no controlados |
| **Session Management** | `getSessions() / killSession()` | Sesiones huérfanas / secuestradas |

---

> **Nota de mantenimiento:** Este documento debe actualizarse cada vez que se introduce un nuevo control de seguridad, se cambia la configuración de un existente, o se identifican nuevas vulnerabilidades en el stack. Se recomienda revisión trimestral y auditoría de penetración anual.

---

*Generado automáticamente desde el código fuente de Easy Point API — Junio 2026*
