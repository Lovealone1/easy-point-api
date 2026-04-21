# 📘 Guía: Creación de Módulos CRUD con Clean Architecture

> **Versión 2.0** — Este documento reemplaza el patrón anterior de 3 capas.
> Todo nuevo módulo debe seguir esta guía completa. Para migrar módulos existentes
> ver [`clean-architecture-migration-guide.md`](./clean-architecture-migration-guide.md).

Este documento describe el patrón estándar del proyecto para crear módulos CRUD
siguiendo Clean Architecture con NestJS + Prisma. La regla central es:

> **El dominio no depende de nadie. La infraestructura depende del dominio.**

---

## Capas y responsabilidades

| Capa | Archivo | Responsabilidad |
|------|---------|-----------------|
| **Dominio** | `domain/{nombre}.entity.ts` | Estado, invariantes y lógica de negocio pura |
| **Infraestructura** | `{nombre}s.repository.ts` | Comunicación con Prisma; mapeo hacia/desde entidad |
| **Aplicación** | `{nombre}s.service.ts` | Orquestación: tenant context, flujos, errores HTTP |
| **Presentación** | `{nombre}s.controller.ts` | Rutas HTTP, guards, Swagger |
| **Entrada** | `dto/` | Validación y transformación de datos de entrada |

---

## Estructura de archivos

```
src/modules/{nombre}/
├── domain/
│   └── {nombre}.entity.ts          ← NUEVO: entidad de dominio
├── dto/
│   ├── create-{nombre}.dto.ts
│   ├── update-{nombre}.dto.ts
│   ├── find-{nombre}s.dto.ts
│   ├── toggle-{nombre}-active.dto.ts   (si aplica)
│   └── add-{nombre}-note.dto.ts        (si aplica)
├── {nombre}s.repository.ts
├── {nombre}s.service.ts
├── {nombre}s.controller.ts
└── {nombre}s.module.ts
```

---

## Paso 1 — Entidad de Dominio ⭐ (nuevo)

La entidad es el núcleo del módulo. Se crea **primero**, antes que el repository y el service.

**Reglas:**
- Usa tipos primitivos + `Prisma.Decimal` (tipo de valor, no clase ORM).
- No importa nada de NestJS, ni decoradores, ni Prisma Client directamente.
- Toda lógica de negocio vive aquí: cálculos, transformaciones, concatenaciones.
- Expone `static fromPrisma()` como único punto de entrada desde la DB.

```typescript
// domain/xxx.entity.ts
import { Prisma } from '@prisma/client';  // solo para Decimal si hay campos monetarios

export class XxxEntity {
  readonly id: string;
  name: string;
  isActive: boolean;
  notes: string | null;
  readonly organizationId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  // ... resto de campos con tipos primitivos

  constructor(params: {
    id: string;
    name: string;
    isActive: boolean;
    notes: string | null;
    organizationId: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = params.id;
    this.name = params.name;
    this.isActive = params.isActive;
    this.notes = params.notes;
    this.organizationId = params.organizationId;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
  }

  // -------------------------------------------------------------------------
  // Lógica de negocio (ejemplos — adaptar según el modelo)
  // -------------------------------------------------------------------------

  /**
   * Acumula una nota al historial. Nunca reemplaza, siempre concatena.
   */
  appendNote(note: string): void {
    this.notes = this.notes ? `${this.notes}\n${note}` : note;
  }

  /**
   * Si el modelo tiene campos monetarios derivados (ej. pricePerUnit):
   * applyPriceChange(newBase?: Prisma.Decimal, newSize?: Prisma.Decimal): void { ... }
   */

  // -------------------------------------------------------------------------
  // Mapeo desde infraestructura
  // -------------------------------------------------------------------------

  /**
   * Construye la entidad desde el modelo raw de Prisma.
   * Único punto de entrada desde la base de datos.
   */
  static fromPrisma(raw: {
    id: string;
    name: string;
    isActive: boolean;
    notes: string | null;
    organizationId: string;
    createdAt: Date;
    updatedAt: Date;
  }): XxxEntity {
    return new XxxEntity({
      id: raw.id,
      name: raw.name,
      isActive: raw.isActive,
      notes: raw.notes,
      organizationId: raw.organizationId,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    });
  }
}
```

> [!IMPORTANT]
> Si el modelo tiene **campos calculados** (ej. `pricePerUnit = basePrice / packageSize`),
> el método de cálculo vive en la entidad, **no en el repository ni en el service**.

> [!TIP]
> Para campos `Decimal` de Prisma (monetarios/numéricos de alta precisión), usar
> `Prisma.Decimal` directamente en la entidad. Es un tipo de valor sin dependencia
> del ORM, no viola la regla de Clean Architecture.

---

## Paso 2 — DTOs

> [!IMPORTANT]
> **El `organizationId` NUNCA va en el body ni en el DTO de creación.** Llega automáticamente
> del header `x-organization-id` a través del `TenantMiddleware` y se obtiene en el service
> con `getTenantId()`. Incluirlo en el DTO es un error de diseño.

### `create-{nombre}.dto.ts`
Solo los campos que el cliente debe proporcionar. Sin `organizationId`.

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsEmail } from 'class-validator';

export class CreateXxxDto {
  // organizationId proviene del header x-organization-id via TenantMiddleware
  // NO debe incluirse en el body

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  // Campos monetarios: usar @IsNumber y @Type(() => Number)
  // @ApiProperty()
  // @IsNotEmpty()
  // @Type(() => Number)
  // @IsNumber({ maxDecimalPlaces: 2 })
  // @Min(0)
  // price: number;

  // Campos enum:
  // @ApiPropertyOptional({ enum: XxxStatus })
  // @IsOptional()
  // @IsEnum(XxxStatus)
  // status?: XxxStatus;
}
```

### `update-{nombre}.dto.ts`
Siempre derivado de `CreateXxxDto` con `PartialType`. Importar **siempre desde `@nestjs/swagger`**.

```typescript
import { PartialType } from '@nestjs/swagger';
import { CreateXxxDto } from './create-xxx.dto.js';

export class UpdateXxxDto extends PartialType(CreateXxxDto) {}
```

Si hay campos que no deben poder actualizarse (ej. `quantityInStock` gestionada por un endpoint dedicado):

```typescript
import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateXxxDto } from './create-xxx.dto.js';

export class UpdateXxxDto extends PartialType(OmitType(CreateXxxDto, ['fieldToExclude'] as const)) {}
```

### `find-{nombre}s.dto.ts`

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { PageOptionsDto } from '../../../common/pagination/page-options.dto.js';

export class FindXxxsDto extends PageOptionsDto {
  // Solo para el endpoint global Admin (filtro adicional)
  // Para rutas de org, el filtro se aplica automáticamente via getTenantId()
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  // Para booleanos desde query string, siempre transformar:
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;
}
```

### DTOs de operaciones puntuales (si aplica)

```typescript
// toggle-xxx-active.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ToggleXxxActiveDto {
  @ApiProperty()
  @IsBoolean()
  isActive: boolean;
}

// add-xxx-note.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AddXxxNoteDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  notes: string;
}
```

---

## Paso 3 — Repository

Responsable **exclusivamente** de interactuar con Prisma:
- Recibe datos del service.
- Ejecuta las queries.
- Mapea el resultado a `XxxEntity` usando `XxxEntity.fromPrisma()`.

> [!IMPORTANT]
> **Cero lógica de negocio aquí.** Si necesitas calcular algo antes de persistir,
> hazlo a través de la entidad (que ya recibiste como parámetro o construyes temporalmente).

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '@prisma/client';
import { XxxEntity } from './domain/xxx.entity.js';

@Injectable()
export class XxxsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.XxxUncheckedCreateInput): Promise<XxxEntity> {
    const raw = await this.prisma.xxx.create({ data });
    return XxxEntity.fromPrisma(raw);
  }

  async findManyWithCount(params: {
    skip?: number;
    take?: number;
    where?: Prisma.XxxWhereInput;
    orderBy?: Prisma.XxxOrderByWithRelationInput;
  }): Promise<[XxxEntity[], number]> {
    const { skip, take, where, orderBy } = params;
    const [rows, count] = await Promise.all([
      this.prisma.xxx.findMany({ skip, take, where, orderBy }),
      this.prisma.xxx.count({ where }),
    ]);
    return [rows.map(XxxEntity.fromPrisma), count];
  }

  async findById(id: string): Promise<XxxEntity | null> {
    const raw = await this.prisma.xxx.findUnique({ where: { id } });
    return raw ? XxxEntity.fromPrisma(raw) : null;
  }

  async update(
    id: string,
    data: Prisma.XxxUncheckedUpdateInput,
  ): Promise<XxxEntity> {
    const raw = await this.prisma.xxx.update({ where: { id }, data });
    return XxxEntity.fromPrisma(raw);
  }

  async delete(id: string): Promise<XxxEntity> {
    const raw = await this.prisma.xxx.delete({ where: { id } });
    return XxxEntity.fromPrisma(raw);
  }
}
```

**Patrón para update con lógica de negocio compleja:**

Si `update` requiere que la entidad intervenga para mantener invariantes (ej. recalcular
un campo derivado), el repository recibe la entidad actual como tercer parámetro:

```typescript
async update(
  id: string,
  data: Omit<Prisma.XxxUncheckedUpdateInput, 'derivedField'>,
  currentEntity: XxxEntity,  // ← contexto para aplicar invariantes
): Promise<XxxEntity> {
  // La entidad aplica su lógica antes de persistir
  currentEntity.applyChange(data.someField as any);

  const raw = await this.prisma.xxx.update({
    where: { id },
    data: {
      ...data,
      derivedField: currentEntity.derivedField, // ← resultado de la entidad
    },
  });
  return XxxEntity.fromPrisma(raw);
}
```

---

## Paso 4 — Service (solo orquestación)

El service **no contiene lógica de negocio**. Coordina:
1. Resolver el contexto de tenant (`getTenantId()`).
2. Obtener entidades del repository.
3. Invocar métodos de la entidad para aplicar lógica de negocio.
4. Llamar al repository para persistir.
5. Lanzar excepciones HTTP (`NotFoundException`, `BadRequestException`).
6. Construir respuestas paginadas.

```typescript
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { XxxsRepository } from './xxxs.repository.js';
import { CreateXxxDto } from './dto/create-xxx.dto.js';
import { UpdateXxxDto } from './dto/update-xxx.dto.js';
import { FindXxxsDto } from './dto/find-xxxs.dto.js';
import { PageMetaDto } from '../../common/pagination/page-meta.dto.js';
import { PageDto } from '../../common/pagination/page.dto.js';
import { getTenantId } from '../../common/context/tenant.context.js';
import { XxxEntity } from './domain/xxx.entity.js';
import { Prisma } from '@prisma/client';

@Injectable()
export class XxxsService {
  constructor(private readonly xxxsRepository: XxxsRepository) {}

  async create(createXxxDto: CreateXxxDto): Promise<XxxEntity> {
    const organizationId = getTenantId();          // ← siempre así
    if (!organizationId) {
      throw new BadRequestException('Missing x-organization-id header');
    }

    return this.xxxsRepository.create({
      ...createXxxDto,
      organizationId,
      // si hay campos Decimal:
      // price: new Prisma.Decimal(createXxxDto.price),
    });
  }

  async findAll(query: FindXxxsDto): Promise<PageDto<XxxEntity>> {
    const where: Prisma.XxxWhereInput = {};

    const tenantId = getTenantId();
    if (tenantId) where.organizationId = tenantId;

    // El admin global puede pasar organizationId como query param para filtrar
    if (query.organizationId) where.organizationId = query.organizationId;

    if (query.name) where.name = { contains: query.name, mode: 'insensitive' };
    if (query.isActive !== undefined) where.isActive = query.isActive;

    const [items, count] = await this.xxxsRepository.findManyWithCount({
      where,
      skip: query.skip,
      take: query.limit,                                                          // ← query.limit, NO query.take
      orderBy: { [query.orderBy]: query.order.toLowerCase() as Prisma.SortOrder }, // ← .toLowerCase()
    });

    const pageMetaDto = new PageMetaDto({ itemCount: count, pageOptionsDto: query });
    return new PageDto(items, pageMetaDto);
  }

  async findOne(id: string): Promise<XxxEntity> {
    const record = await this.xxxsRepository.findById(id);
    if (!record) throw new NotFoundException(`Xxx with ID ${id} not found`);
    return record;
  }

  async update(id: string, updateXxxDto: UpdateXxxDto): Promise<XxxEntity> {
    const current = await this.findOne(id);
    return this.xxxsRepository.update(id, updateXxxDto, current);
  }

  async remove(id: string): Promise<XxxEntity> {
    await this.findOne(id);
    return this.xxxsRepository.delete(id);
  }

  async toggleActive(id: string, isActive: boolean): Promise<XxxEntity> {
    const current = await this.findOne(id);
    return this.xxxsRepository.update(id, { isActive }, current);
  }

  async addNote(id: string, note: string): Promise<XxxEntity> {
    const entity = await this.findOne(id);

    // La entidad aplica la lógica de concatenación — el service solo orquesta
    entity.appendNote(note);

    return this.xxxsRepository.update(id, { notes: entity.notes }, entity);
  }
}
```

---

## Paso 5 — Controller

**Reglas de seguridad por tipo de endpoint:**

| Tipo de ruta | Guards | Decoradores de rol |
|---|---|---|
| Rutas de la organización | `JwtAuthGuard`, `OrgRolesGuard` | `@OrgRoles(Role.OWNER, Role.ADMINISTRATOR)` + `@ApiSecurity('x-organization-id')` |
| Ruta global para Admin | `JwtAuthGuard`, `RolesGuard` | `@Roles(GlobalRole.ADMIN)` |

```typescript
import {
  Controller, Get, Post, Body, Patch, Param, Delete,
  UseGuards, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { XxxsService } from './xxxs.service.js';
import { CreateXxxDto } from './dto/create-xxx.dto.js';
import { UpdateXxxDto } from './dto/update-xxx.dto.js';
import { FindXxxsDto } from './dto/find-xxxs.dto.js';
import { ToggleXxxActiveDto } from './dto/toggle-xxx-active.dto.js';
import { AddXxxNoteDto } from './dto/add-xxx-note.dto.js';
import {
  ApiTags, ApiOperation, ApiBearerAuth, ApiSecurity,
  ApiOkResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { OrgRolesGuard } from '../../common/guards/org-roles.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { OrgRoles } from '../../common/decorators/org-roles.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role, GlobalRole } from '@prisma/client';
import { PageDto } from '../../common/pagination/page.dto.js';

@ApiTags('Xxxs')
@ApiBearerAuth()
@Controller('xxxs')
export class XxxsController {
  constructor(private readonly xxxsService: XxxsService) {}

  // --- RUTA GLOBAL ADMIN (declarada antes de :id) ---

  @Get('global/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.ADMIN)
  @ApiOperation({ summary: 'Get all globally (Global Admin)' })
  @ApiOkResponse({ type: PageDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findAllGlobal(@Query() findOptionsDto: FindXxxsDto) {
    return this.xxxsService.findAll(findOptionsDto);
  }

  // --- RUTAS DE ORGANIZACIÓN ---

  @Post()
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create (Org Owner / Org Admin)' })
  @ApiCreatedResponse({ description: 'Created successfully.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  create(@Body() createXxxDto: CreateXxxDto) {
    return this.xxxsService.create(createXxxDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'List paginated (Org Owner / Org Admin)' })
  @ApiOkResponse({ type: PageDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findAll(@Query() findOptionsDto: FindXxxsDto) {
    return this.xxxsService.findAll(findOptionsDto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Get by ID (Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'Record found.' })
  @ApiNotFoundResponse({ description: 'Not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findOne(@Param('id') id: string) {
    return this.xxxsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Update (Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'Updated successfully.' })
  @ApiNotFoundResponse({ description: 'Not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  update(@Param('id') id: string, @Body() updateXxxDto: UpdateXxxDto) {
    return this.xxxsService.update(id, updateXxxDto);
  }

  @Patch(':id/toggle-active')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Toggle active status (Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'Status updated.' })
  @ApiNotFoundResponse({ description: 'Not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  toggleActive(@Param('id') id: string, @Body() toggleDto: ToggleXxxActiveDto) {
    return this.xxxsService.toggleActive(id, toggleDto.isActive);
  }

  @Post(':id/notes')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add note (Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'Note appended.' })
  @ApiNotFoundResponse({ description: 'Not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  addNote(@Param('id') id: string, @Body() noteDto: AddXxxNoteDto) {
    return this.xxxsService.addNote(id, noteDto.notes);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Delete (Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'Deleted successfully.' })
  @ApiNotFoundResponse({ description: 'Not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  remove(@Param('id') id: string) {
    return this.xxxsService.remove(id);
  }
}
```

> [!WARNING]
> El endpoint `GET global/all` debe estar declarado **antes** del `GET :id` en el archivo,
> o de lo contrario NestJS interpretará `global` como un parámetro de ruta `:id`.

---

## Paso 6 — Module

```typescript
import { Module } from '@nestjs/common';
import { XxxsService } from './xxxs.service.js';
import { XxxsController } from './xxxs.controller.js';
import { XxxsRepository } from './xxxs.repository.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [XxxsController],
  providers: [XxxsService, XxxsRepository],
  exports: [XxxsService],
})
export class XxxsModule {}
```

---

## Paso 7 — Registrar en `app.module.ts`

```typescript
// 1. Añadir el import en la parte superior:
import { XxxsModule } from './modules/xxxs/xxxs.module.js';

// 2. Añadir en el array imports:
@Module({
  imports: [
    // ... módulos existentes ...
    XxxsModule,
  ],
})
export class AppModule {}
```

---

## Checklist de creación

- `[ ]` Modelo añadido a `schema.prisma` con sus campos e índices
- `[ ]` Se ejecutó `npx prisma db push` (o migración) + `npx prisma generate`
- `[ ]` **`domain/xxx.entity.ts`** — entidad creada con toda la lógica de negocio
- `[ ]` `create-xxx.dto.ts` con todos los campos y sus validaciones
- `[ ]` `update-xxx.dto.ts` usando `PartialType` (y `OmitType` si aplica)
- `[ ]` `find-xxxs.dto.ts` extendiendo `PageOptionsDto`
- `[ ]` DTOs extra para operaciones puntuales (toggle, notes, etc.)
- `[ ]` `xxxs.repository.ts` — solo Prisma, retorna `XxxEntity`, cero lógica
- `[ ]` `xxxs.service.ts` — solo orquestación, lógica en la entidad
- `[ ]` `xxxs.controller.ts` con guards correctos por endpoint
- `[ ]` `xxxs.module.ts` con todos los providers registrados
- `[ ]` Módulo importado en `app.module.ts`

---

## Errores comunes a evitar

| Error | Causa | Solución |
|---|---|---|
| Lógica de negocio en el service | Service mezcla orquestación con dominio | Mover la lógica a un método de la entidad |
| Lógica de negocio en el repository | Repository calcula campos derivados | La entidad calcula; el repository solo persiste |
| `Property 'take' does not exist` | `PageOptionsDto` usa `limit` no `take` | Usar `query.limit` |
| `Decimal` no asignable | Campos monetarios deben convertirse | `new Prisma.Decimal(value)` |
| `SortOrder` inválido | Prisma espera minúsculas | `query.order.toLowerCase() as Prisma.SortOrder` |
| Ruta `global` resuelta como `:id` | Orden de declaración en controller | Declarar `GET global/all` **antes** de `GET :id` |
| `UpdateXxxDto` no refleja en Swagger | Import desde `@nestjs/mapped-types` | Siempre importar `PartialType`/`OmitType` desde `@nestjs/swagger` |
| `organizationId` en el body del create | Anti-patrón: expone campo interno al cliente | Usar `getTenantId()` en el service; **nunca** en el DTO |
| Datos de otra org visibles en el listado | `findAll` sin filtro tenant | Aplicar `if (tenantId) where.organizationId = tenantId` con `getTenantId()` |
| Repository retorna tipo Prisma (`Supply`) | Fuga de infraestructura a capas superiores | Todos los métodos del repository deben retornar `XxxEntity` |

---

## Módulo de referencia

El módulo `supplies` es la implementación de referencia de este patrón:

```
src/modules/supplies/
├── domain/
│   └── supply.entity.ts     ← ver para ejemplo completo con Decimal y campos calculados
├── dto/                     ← 6 DTOs cubriendo todos los casos
├── supplies.repository.ts   ← patrón con update recibiendo entidad
├── supplies.service.ts      ← orquestación pura
└── supplies.controller.ts
```
