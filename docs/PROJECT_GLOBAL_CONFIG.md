# 🛠️ Configuración Global del Proyecto & Estándar de Arquitectura API

Este documento recopila la **configuración global**, la infraestructura base, la contenerización (**Docker** y **Docker Compose**), el arranque con **Swagger/ReDoc**, el estándar de **Clean Architecture CRUD** y la suite de **pruebas unitarias base** para exportar e implementar en cualquier proyecto NestJS de nivel producción.

---

## 📋 Índice
1. [Arranque Principal y Documentación Automática (`main.ts`)](#1-arranque-principal-y-documentación-automática-maints)
2. [Configuración Global de Infraestructura](#2-configuración-global-de-infraestructura)
   - [Base de Datos & Prisma (`PrismaService` + Multi-tenant)](#21-base-de-datos--prisma-prismaservice--multi-tenant)
   - [Caché & Resiliencia con Redis (`RedisModule`)](#22-caché--resiliencia-con-redis-redismodule)
   - [Almacenamiento en la Nube / S3 (`StorageService`)](#23-almacenamiento-en-la-nube--s3-storageservice)
   - [Configuración Unificada de Entorno (`config.ts`)](#24-configuración-unificada-de-entorno-configts)
3. [Pipeline de Middlewares Globales (`app.module.ts`)](#3-pipeline-de-middlewares-globales-appmodulets)
4. [Contenerización: Desarrollo Local y Producción](#4-contenerización-desarrollo-local-y-producción)
   - [Desarrollo (`docker compose up`)](#41-desarrollo-docker-compose-up)
   - [Producción (`compose.yaml` + `compose.prod.yaml`)](#42-producción-composeyaml--composeprodyaml)
5. [Estándar de Arquitectura CRUD Módulo Básico (Clean Architecture)](#5-estándar-de-arquitectura-crud-módulo-básico-clean-architecture)
6. [Estándar de Archivos de Prueba Base (Testing Suite con Jest)](#6-estándar-de-archivos-de-prueba-base-testing-suite-con-jest)
7. [Guías Markdown Portátiles Disponibles para Otros Proyectos](#7-guías-markdown-portátiles-disponibles-para-otros-proyectos)

---

## 1. Arranque Principal y Documentación Automática (`main.ts`)

El archivo `src/main.ts` configura la seguridad de cabeceras (`helmet`), el parseo de galletas (`cookie-parser`), la validación global de DTOs (`ValidationPipe`), el versionado URI de la API (`/api/v1`), la compresión/filtros de excepción globales y la generación dual de documentación interactiva **Swagger UI** (`/api/swagger`) y documentación estática interactiva **ReDoc** (`/api/docs`).

### 📄 Código de Referencia: `src/main.ts`

```typescript
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { ConfigType } from '@nestjs/config';
import Redis from 'ioredis';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { AppLogger } from './common/logger/app.logger.js';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter.js';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { RedocModule, RedocOptions } from 'nestjs-redoc';
import appConfig from './common/config/config.js';
import { REDIS_CLIENT } from './infraestructure/redis/redis.constants.js';

async function bootstrap() {
  const appLogger = new AppLogger();

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    bodyParser: false, // Deshabilitado para permitir JsonBodyMiddleware flexible (ej. Webhooks)
  });

  app.useLogger(appLogger);
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.use(helmet());
  app.use(cookieParser());

  // Validación estricta global de DTOs de entrada
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Configuración de CORS
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.setGlobalPrefix('api');

  // Versionado URI (/api/v1/...)
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // ---------------------------------------------------------------------------
  // 📚 Configuración de Swagger UI
  // ---------------------------------------------------------------------------
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Easy Point API')
    .setDescription('Core ERP SaaS - API Reference')
    .setVersion('1.0.0')
    .addBearerAuth()
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'x-organization-id' },
      'x-organization-id',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  // Endpoint de Pruebas Interactivas (Swagger)
  SwaggerModule.setup('/api/swagger', app, document);

  // ---------------------------------------------------------------------------
  // 📚 Configuración de ReDoc (Documentación Estática Tematizada)
  // ---------------------------------------------------------------------------
  const redocOptions: RedocOptions = {
    title: 'Easy Point API Docs',
    sortPropsAlphabetically: true,
    hideDownloadButton: true,
    hideHostname: false,
    theme: {
      colors: {
        primary: {
          main: '#32329f',
        },
      },
    },
  };

  // Endpoint de Documentación ReDoc
  await RedocModule.setup('/api/docs', app, document, redocOptions);

  // Verificación opcional de conexión a Redis durante el arranque
  const runtimeConfig = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);
  const redisClient = app.get<Redis>(REDIS_CLIENT);
  const port = runtimeConfig.app.port;
  const appUrl = runtimeConfig.app.apiBaseUrl.replace(/\/api$/, '');

  if (runtimeConfig.redis.enabled) {
    try {
      if (
        redisClient.status === 'wait' ||
        (redisClient.status !== 'ready' && redisClient.status !== 'connect')
      ) {
        await redisClient.connect();
      }
      appLogger.success(
        `Redis connected on ${runtimeConfig.redis.host}:${runtimeConfig.redis.port}/${runtimeConfig.redis.db}`,
      );
    } catch (error) {
      const redisError =
        error instanceof Error ? error : new Error(String(error));
      appLogger.error(
        `Failed to connect Redis: ${redisError.message}`,
        redisError.stack,
      );
      throw redisError;
    }
  } else {
    appLogger.warn('Redis is disabled by configuration');
  }

  await app.listen(port);

  appLogger.success(`🚀 API running on ${appUrl}/api`);
  appLogger.debug(`📚 Swagger UI available on ${appUrl}/api/swagger`);
  appLogger.debug(`📚 Redoc Documentation available on ${appUrl}/api/docs`);
}

bootstrap();
```

---

## 2. Configuración Global de Infraestructura

### 2.1 Base de Datos & Prisma (`PrismaService` + Multi-tenant)

Prisma se configura utilizando el adaptador nativo de PostgreSQL (`@prisma/adapter-pg`) y aprovecha `$extends` junto con `AsyncLocalStorage` (`tenantContextStorage`) para inyectar automáticamente el filtro `organizationId` en todas las consultas de la base de datos sin contaminar los repositorios.

#### 📄 Configuración de Prisma v6 (`prisma.config.ts`)

```typescript
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'npx tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DIRECT_URL'),
  },
});
```

#### 📄 Servicio de Prisma (`src/prisma/prisma.service.ts`)

```typescript
import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import appConfig from '../common/config/config.js';
import { getTenantContext } from '../common/context/tenant.context.js';

// Modelos donde se auto-aplica el filtro tenant
const tenantAwareModels = ['OrganizationUser', 'Client', 'Supplier', 'Product', 'Sale'];

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy {
  constructor(
    @Inject(appConfig.KEY)
    config: ConfigType<typeof appConfig>,
  ) {
    const connectionString = config.database.url;
    if (!connectionString) throw new Error('DATABASE_URL is missing');

    const adapter = new PrismaPg({ connectionString });
    super({ adapter });

    const extendedClient = this.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            if (model && tenantAwareModels.includes(model)) {
              const ctx = getTenantContext();

              if (ctx && ctx.organizationId && !ctx.bypassTenant) {
                const organizationId = ctx.organizationId;
                const mutableArgs = (args || {}) as any;

                if (
                  ['findUnique', 'findFirst', 'findMany', 'count', 'update', 'updateMany', 'delete', 'deleteMany'].includes(operation)
                ) {
                  mutableArgs.where = { ...mutableArgs.where, organizationId };
                } else if (['create', 'createMany'].includes(operation)) {
                  if (Array.isArray(mutableArgs.data)) {
                    mutableArgs.data = mutableArgs.data.map((d: any) => ({ ...d, organizationId }));
                  } else if (mutableArgs.data) {
                    mutableArgs.data = { ...mutableArgs.data, organizationId };
                  }
                }
              }
            }
            return query(args);
          },
        },
      },
    });

    const finalClient = extendedClient as any;
    finalClient.onModuleInit = async () => { await this.$connect(); };
    finalClient.onModuleDestroy = async () => { await this.$disconnect(); };

    return finalClient as this;
  }

  async onModuleInit() {}
  async onModuleDestroy() {}
}
```

---

### 2.2 Caché & Resiliencia con Redis (`RedisModule`)

Módulo global con `ioredis` para gestión de sesiones, cachés dinámicos, invalidez de tokens y Rate Limiting por IP o Usuario.

#### 📄 Módulo de Redis (`src/infraestructure/redis/redis.module.ts`)

```typescript
import {
  FactoryProvider, Global, Inject, Logger, Module, OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import type { ConfigType } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';
import appConfig from '../../common/config/config.js';
import { REDIS_CLIENT } from './redis.constants.js';
import { RedisCacheService } from './redis-cache.service.js';

const redisClientProvider: FactoryProvider<Redis> = {
  provide: REDIS_CLIENT,
  inject: [appConfig.KEY],
  useFactory: (config: ConfigType<typeof appConfig>): Redis => {
    const redisConfig = config.redis;
    const options: RedisOptions = {
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password,
      db: redisConfig.db,
      keyPrefix: `${redisConfig.keyPrefix}:`,
      lazyConnect: true,
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    };
    return new Redis(options);
  },
};

@Global()
@Module({
  imports: [ConfigModule],
  providers: [redisClientProvider, RedisCacheService],
  exports: [REDIS_CLIENT, RedisCacheService],
})
export class RedisModule implements OnApplicationShutdown {
  private readonly logger = new Logger(RedisModule.name);

  constructor(
    @Inject(appConfig.KEY) config: ConfigType<typeof appConfig>,
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
  ) {
    this.redisClient.on('ready', () => this.logger.log('Redis connection established'));
    this.redisClient.on('end', () => this.logger.warn('Redis connection closed'));
    this.redisClient.on('error', (err) => this.logger.error(`Redis error: ${err.message}`, err.stack));
  }

  async onApplicationShutdown(): Promise<void> {
    try {
      await this.redisClient.quit();
      this.logger.log('Redis client disconnected gracefully');
    } catch {
      this.redisClient.disconnect(false);
    }
  }
}
```

---

### 2.3 Almacenamiento en la Nube / S3 (`StorageService`)

Compatible con AWS S3, Supabase Storage, MinIO, Cloudflare R2 o DigitalOcean Spaces. Soporta subidas en Buffer, eliminación de objetos y generación de presigned URLs temporales.

#### 📄 Servicio de Storage (`src/infraestructure/storage/storage.service.ts`)

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(private readonly configService: ConfigService) {
    const s3Config = this.configService.get('app.s3');
    this.bucketName = s3Config.bucketName;

    this.s3Client = new S3Client({
      endpoint: s3Config.endpoint,
      region: s3Config.region,
      credentials: {
        accessKeyId: s3Config.accessKeyId,
        secretAccessKey: s3Config.secretAccessKey,
      },
      forcePathStyle: true, // Requerido para Supabase Storage, MinIO y S3 compatible
    });
  }

  async uploadFile(fileBuffer: Buffer, fileName: string, mimetype: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: fileName,
      Body: fileBuffer,
      ContentType: mimetype,
    });
    await this.s3Client.send(command);
    return fileName;
  }

  async deleteFile(fileName: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: fileName,
    });
    await this.s3Client.send(command);
  }

  async getPresignedUrl(fileName: string, expiresInSeconds: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: fileName,
    });
    return getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
  }
}
```

---

### 2.4 Configuración Unificada de Entorno (`config.ts`)

Centraliza el tipado y parseo seguro de variables `.env` con soporte para formatos como `15m`, `30d`, `60s`.

```typescript
// Ejemplo de estructura simplificada
export default registerAs('app', () => ({
  app: {
    env: process.env.NODE_ENV || 'development',
    port: Number(process.env.PORT || 3000),
    apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000/api',
  },
  database: {
    url: process.env.DATABASE_URL,
    directUrl: process.env.DIRECT_URL,
  },
  redis: {
    enabled: process.env.REDIS_ENABLED !== 'false',
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  s3: {
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || 'us-east-1',
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    bucketName: process.env.S3_BUCKET_NAME,
  },
}));
```

---

## 3. Pipeline de Middlewares Globales (`app.module.ts`)

Los middlewares se registran en orden en `AppModule`:

1. `JsonBodyMiddleware`: Permite recibir cuerpos JSON crudos para firmas de Webhook o req estándar.
2. `RequestInfoMiddleware`: Agrega metadatos (Correlation ID, IP, User Agent).
3. `LoggerMiddleware`: Registra la respuesta HTTP en consola.
4. `TenantMiddleware`: Captura `x-organization-id` de la cabecera y lo registra en `AsyncLocalStorage`.
5. `RateLimitMiddleware`: Controla la cuota de peticiones mediante Redis en 5 niveles (Global, Strict IP, Moderate IP, Read Ops, Write Ops).

```typescript
@Module({ ... })
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(
        JsonBodyMiddleware,
        RequestInfoMiddleware,
        LoggerMiddleware,
        TenantMiddleware,
        RateLimitMiddleware,
      )
      .forRoutes('{*path}');
  }
}
```

---

## 4. Contenerización: Desarrollo Local y Producción

El proyecto usa **dos imágenes Docker separadas** y **dos archivos Compose combinables**: uno para desarrollo (hot-reload) y un override de producción (imagen multi-stage, Postgres self-hosted, Caddy con TLS automático, backups cifrados fuera del servidor). El detalle operativo completo (sizing de VPS, generación de secretos, migración de datos, checklist post-deploy) vive en [`DEPLOYMENT.md`](./DEPLOYMENT.md); esta sección documenta solo la arquitectura de los archivos.

### 🖼️ Imágenes y Servicios

| Archivo | Uso | Servicios que define |
|---|---|---|
| `Dockerfile.dev` | Desarrollo | Imagen única `node:22-alpine`, `pnpm start:dev` con hot-reload |
| `Dockerfile` | Producción | Multi-stage (`deps` → `build` → `prod-deps` → `runner`); usuario no-root, sin devDependencies, sin CLI de Prisma, sin `curl`, `prisma generate` en build-time |
| `compose.yaml` | Base (dev) | `easy-point-api` (hot-reload), `postgres`, `social-redis`, `redis-commander` (perfil `tools`) |
| `compose.prod.yaml` | Override (prod) | Reconfigura `easy-point-api`/`postgres`/`social-redis` para producción + añade `caddy`, `postgres-backup`, `migrate` (perfil `migrate`) |
| `Caddyfile` | Producción | TLS automático (Let's Encrypt), reverse proxy, cabeceras de seguridad |
| `docker/backup/` | Producción | Sidecar: `pg_dump` cifrado (AES-256) subido a almacenamiento S3-compatible, con poda automática por retención |

### 4.1 Desarrollo (`docker compose up`)

```bash
docker compose up                    # API + Postgres + Redis
docker compose --profile tools up    # + Redis Commander (http://localhost:8081)
```

`easy-point-api` monta `./src` y `./prisma` en vivo; `postgres` y `social-redis` publican solo en `127.0.0.1` (no accesibles fuera del host). `DATABASE_URL`/`DIRECT_URL` se sobrescriben en `compose.yaml` para apuntar al servicio `postgres` interno, siguiendo el mismo patrón que ya existía para `REDIS_HOST`.

### 4.2 Producción (`compose.yaml` + `compose.prod.yaml`)

```bash
docker compose -f compose.yaml -f compose.prod.yaml --profile migrate run --rm migrate
docker compose -f compose.yaml -f compose.prod.yaml up -d --build
```

El override usa el tag `!reset []` de la especificación Compose para limpiar explícitamente los puertos publicados y los bind mounts de desarrollo (en vez de depender de la semántica de fusión de listas), de modo que en producción `easy-point-api`, `postgres` y `social-redis` **no publican ningún puerto al host** — todo el tráfico entra exclusively por `caddy` (puertos 80/443), que hace TLS termination y reverse proxy hacia `easy-point-api:3001` sobre la red interna `easy-point-net`.

El servicio `migrate` (perfil `migrate`, sin arrancar por defecto) reutiliza el stage `build` de la imagen productiva — que sí trae el CLI de Prisma — para ejecutar `prisma migrate deploy` como un job de un solo uso, separado del ciclo de vida del contenedor de la API.

Ver [`DEPLOYMENT.md`](./DEPLOYMENT.md) para el procedimiento completo de despliegue, migración de datos desde Supabase, y el drill de backup/restore.

### 4.3 Tamaño de la imagen de producción

La imagen partió de 975 MB. Se redujo a **560 MB reales en disco / ~127 MB comprimida** (lo que efectivamente viaja en un `docker push`/`docker pull`), quitando del árbol de producción software que solo hacía falta en build o en desarrollo:

| Cambio | Ahorro aprox. |
|---|---|
| CLI de Prisma + `@prisma/engines` + `studio-core` + `@prisma/dev` + `pglite` (ver §14.1 de `SECURITY.md`) | ~180 MB |
| Peers huérfanos (`typescript`, `prettier`, `react`, `react-dom`) que Prisma Studio arrastraba como *peerDependencies* | ~42 MB |
| `nestjs-redoc` movido a `devDependencies`, cargado con `import()` dinámico solo si `SWAGGER_ENABLED=true` (ver `src/main.ts`) — se lleva consigo `react`/`react-dom`/`chart.js` en producción | ~20 MB |
| `curl` fuera del runner — el `HEALTHCHECK` usa el `fetch` global de Node 22 | ~5 MB |

**`--config.node-linker=hoisted`** en cada `pnpm install` del `Dockerfile`: sin esto, pnpm coloca el cliente de Prisma generado dentro de su store virtual (`node_modules/.pnpm/@prisma+client@<hash>/…`), una ruta con hash que no es estable para `COPY --from=build`. Con el linker plano, la etapa `prod-deps` copia el cliente ya generado desde `build` en una ruta fija (`node_modules/@prisma/client` + `node_modules/.prisma`) en vez de tener que regenerarlo con el CLI.

> ⚠️ **`docker images` no es confiable para medir esto en Docker Desktop sobre Windows.** Con el snapshotter de containerd (`driver-type: io.containerd.snapshotter.v1`, visible en `docker info`), la misma imagen reportó 693 MB en `docker images` y 127 MB en `docker image inspect --format '{{.Size}}'` — dos números distintos para el mismo artefacto. La cifra confiable es la suma de las capas reales (`docker history --no-trunc`) o, mejor aún, el tamaño comprimido (`docker save <img> | gzip | wc -c`), que es el que de verdad determina cuánto tarda un `docker pull` en el VPS. En un Docker Engine estándar sobre Linux (`overlay2`, lo habitual en el VPS de producción) este problema no debería reproducirse.

---

## 5. Estándar de Arquitectura CRUD Módulo Básico (Clean Architecture)

Regla central de desacoplamiento: **El Dominio no depende de la Infraestructura; la Infraestructura depende del Dominio.**

### Estructura de Capas por Módulo:

```
src/modules/clients/
├── domain/
│   └── client.entity.ts         ← Entidad pura (Invariantes, transformaciones, fromPrisma)
├── dto/
│   ├── create-client.dto.ts     ← Sin organizationId (llega via TenantMiddleware)
│   ├── update-client.dto.ts     ← Usando PartialType de @nestjs/swagger
│   └── find-clients.dto.ts      ← Heredando de PageOptionsDto
├── clients.repository.ts        ← Repositorio aislado; solo interactúa con Prisma y retorna ClientEntity
├── clients.service.ts           ← Orquestador puro; sin lógica de negocio en el service
├── clients.controller.ts        ← Controller HTTP con Swagger + Decoradores de Guard/Roles
└── clients.module.ts
```

> 📘 Para ver el detalle técnico completo con ejemplos de código paso a paso, consulta el archivo portable [`crud-module-guide.md`](./crud-module-guide.md).

---

## 6. Estándar de Archivos de Prueba Base (Testing Suite con Jest)

A continuación se muestra la plantilla estándar para escribir pruebas unitarias de **Entidad de Dominio**, **Servicio (con Mocks)** y **Controlador**.

### 🧪 6.1 Pruebas Unitarias de Entidad (`domain/client.entity.spec.ts`)

```typescript
import { ClientEntity } from './client.entity.js';

describe('ClientEntity', () => {
  const rawPrismaData = {
    id: 'client-1',
    name: 'Acme Corp',
    email: 'contact@acme.com',
    phone: '+123456789',
    isActive: true,
    notes: 'Initial note',
    organizationId: 'org-1',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  it('should correctly instantiate from static fromPrisma', () => {
    const entity = ClientEntity.fromPrisma(rawPrismaData);

    expect(entity).toBeInstanceOf(ClientEntity);
    expect(entity.id).toBe('client-1');
    expect(entity.name).toBe('Acme Corp');
    expect(entity.organizationId).toBe('org-1');
  });

  it('should correctly append notes without overwriting existing content', () => {
    const entity = ClientEntity.fromPrisma(rawPrismaData);

    entity.appendNote('Follow-up call on Monday');

    expect(entity.notes).toBe('Initial note\nFollow-up call on Monday');
  });
});
```

---

### 🧪 6.2 Pruebas Unitarias de Servicio (`clients.service.spec.ts`)

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ClientsService } from './clients.service.js';
import { ClientsRepository } from './clients.repository.js';
import { ClientEntity } from './domain/client.entity.js';
import { PageDto } from '../../common/pagination/page.dto.js';
import { PageOptionsDto } from '../../common/pagination/page-options.dto.js';

describe('ClientsService', () => {
  let service: ClientsService;
  let repository: jest.Mocked<ClientsRepository>;

  const mockClientEntity = new ClientEntity({
    id: 'client-1',
    name: 'Acme Corp',
    email: 'contact@acme.com',
    phone: '+123456789',
    isActive: true,
    notes: null,
    organizationId: 'org-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      findManyWithCount: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientsService,
        { provide: ClientsRepository, useValue: mockRepository },
      ],
    }).compile();

    service = module.get<ClientsService>(ClientsService);
    repository = module.get(ClientsRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    it('should return a ClientEntity when found', async () => {
      repository.findById.mockResolvedValue(mockClientEntity);

      const result = await service.findOne('client-1');

      expect(repository.findById).toHaveBeenCalledWith('client-1');
      expect(result).toEqual(mockClientEntity);
    });

    it('should throw NotFoundException when client does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return a paginated PageDto of ClientEntity', async () => {
      const pageOptions = new PageOptionsDto();
      repository.findManyWithCount.mockResolvedValue([[mockClientEntity], 1]);

      const result = await service.findAll(pageOptions);

      expect(result).toBeInstanceOf(PageDto);
      expect(result.data).toEqual([mockClientEntity]);
      expect(result.meta.itemCount).toBe(1);
    });
  });
});
```

---

### 🧪 6.3 Pruebas Unitarias de Controlador (`clients.controller.spec.ts`)

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ClientsController } from './clients.controller.js';
import { ClientsService } from './clients.service.js';
import { ClientEntity } from './domain/client.entity.js';

describe('ClientsController', () => {
  let controller: ClientsController;
  let service: jest.Mocked<ClientsService>;

  const mockClientEntity = new ClientEntity({
    id: 'client-1',
    name: 'Acme Corp',
    email: 'contact@acme.com',
    phone: null,
    isActive: true,
    notes: null,
    organizationId: 'org-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClientsController],
      providers: [{ provide: ClientsService, useValue: mockService }],
    }).compile();

    controller = module.get<ClientsController>(ClientsController);
    service = module.get(ClientsService);
  });

  it('should create a client', async () => {
    service.create.mockResolvedValue(mockClientEntity);

    const dto = { name: 'Acme Corp', email: 'contact@acme.com' };
    const result = await controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockClientEntity);
  });
});
```

---

## 7. Guías Markdown Portátiles Disponibles para Otros Proyectos

Todo el conjunto de documentación de arquitectura del proyecto está estructurado en archivos `.md` independientes ubicados en la carpeta `docs/`. Puedes copiarlos directamente a cualquier otro proyecto NestJS:

| Archivo Markdown | Descripción / Propósito | Reutilizable |
|------------------|-------------------------|--------------|
| 📄 [`PROJECT_GLOBAL_CONFIG.md`](./PROJECT_GLOBAL_CONFIG.md) | **Configuración Global unificada**: `main.ts` (Swagger/ReDoc), Redis, Storage S3, Prisma Multi-Tenant, Middlewares, Docker Compose / Dockerfile y plantillas de pruebas base. | ✅ Sí (Máxima prioridad) |
| 📘 [`crud-module-guide.md`](./crud-module-guide.md) | **Guía de desarrollo de módulos CRUD**: Especificación completa paso a paso con Clean Architecture (Entidades de dominio, DTOs sin leak de tenantId, Repositorios desacoplados). | ✅ Sí |
| 🔄 [`clean-architecture-migration-guide.md`](./clean-architecture-migration-guide.md) | **Guía de migración**: Paso a paso para transformar módulos legados Controller-Service-Repository al estándar v2 con Dominio. | ✅ Sí |
| 🛡️ [`SECURITY.md`](./SECURITY.md) | **Estándar de Seguridad API**: Guía de hardening de cabeceras, políticas CORS, tokens JWT, invalidez por cambio de rol y sanitización. | ✅ Sí |
| 🔐 [`permissions-wiring.md`](./permissions-wiring.md) | **Cableado de Permisos y RBAC**: Decoradores `@OrgRoles` y `@Roles`, Guards y verificación dinámica por sistema/módulo. | ✅ Sí |
| 📜 [`audit-log-guide.md`](./audit-log-guide.md) | **Sistema de Auditoría**: Publicación asíncrona de eventos via `EventEmitterModule` y consumidor en segundo plano sanitizado. | ✅ Sí |
| 🚀 [`DEPLOYMENT.md`](./DEPLOYMENT.md) | **Guía de Despliegue**: Sizing de VPS, Docker Compose de producción, TLS con Caddy, migración de base de datos, backups cifrados fuera del servidor y checklist post-deploy. | ⚠️ Parcial (asume VPS + Docker) |

---
> 🚀 **Nota para exportación:** Para llevarte todo el sistema de arquitectura a otro proyecto backend, simplemente copia el directorio `docs/` completo y adapta las entidades de la base de datos en tu nuevo esquema Prisma.
