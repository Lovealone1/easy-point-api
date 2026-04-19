# 📘 Guía: Creación de Módulos CRUD con Patrón Repository

Este documento describe el patrón estándar de este proyecto para crear módulos CRUD con NestJS + Prisma. Todos los módulos deben seguir esta estructura.

---

## Estructura de archivos

```
src/modules/{nombre}/
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

## Paso 1 — DTOs

### `create-{nombre}.dto.ts`
Todos los campos del modelo Prisma con sus validaciones. Los campos requeridos sin `@IsOptional()`, los opcionales con `@IsOptional()`.

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsEmail } from 'class-validator';

export class CreateXxxDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  organizationId: string;

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
  // creditLimit: number;

  // Campos enum:
  // @ApiPropertyOptional({ enum: XxxStatus })
  // @IsOptional()
  // @IsEnum(XxxStatus)
  // status?: XxxStatus;
}
```

### `update-{nombre}.dto.ts`
Siempre derivado de `CreateXxxDto`. Usa `OmitType` para excluir `organizationId` y `PartialType` para hacer todos los campos opcionales. **Importar siempre desde `@nestjs/swagger`** para que Swagger refleje correctamente los tipos.

```typescript
import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateXxxDto } from './create-xxx.dto.js';

export class UpdateXxxDto extends PartialType(
  OmitType(CreateXxxDto, ['organizationId'] as const)
) {}
```

### `find-{nombre}s.dto.ts`
Hereda paginación y búsqueda de `PageOptionsDto`. Añadir filtros específicos del modelo.

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { PageOptionsDto } from '../../../common/pagination/page-options.dto.js';

export class FindXxxsDto extends PageOptionsDto {
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

## Paso 2 — Repository

Responsable **exclusivamente** de interactuar con Prisma. Cero lógica de negocio.

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma, Xxx } from '@prisma/client';

@Injectable()
export class XxxsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.XxxUncheckedCreateInput): Promise<Xxx> {
    return this.prisma.xxx.create({ data });
  }

  async findManyWithCount(params: {
    skip?: number;
    take?: number;
    where?: Prisma.XxxWhereInput;
    orderBy?: Prisma.XxxOrderByWithRelationInput;
  }): Promise<[any[], number]> {
    const { skip, take, where, orderBy } = params;
    return Promise.all([
      this.prisma.xxx.findMany({ skip, take, where, orderBy }),
      this.prisma.xxx.count({ where }),
    ]);
  }

  async findById(id: string): Promise<Xxx | null> {
    return this.prisma.xxx.findUnique({ where: { id } });
  }

  async update(id: string, data: Prisma.XxxUncheckedUpdateInput): Promise<Xxx> {
    return this.prisma.xxx.update({ where: { id }, data });
  }

  async delete(id: string): Promise<Xxx> {
    return this.prisma.xxx.delete({ where: { id } });
  }
}
```

---

## Paso 3 — Service

Responsable de la lógica de negocio, validaciones y manejo de errores.

**Reglas clave:**
- Siempre hacer `findOne()` antes de `update()` y `delete()` para lanzar `NotFoundException` si no existe.
- Campos `Decimal` de Prisma deben envolverse en `new Prisma.Decimal(valor)`.
- Para paginación usar `query.limit` (NO `query.take`) y convertir el orden a minúsculas con `.toLowerCase() as Prisma.SortOrder`.

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { XxxsRepository } from './xxxs.repository.js';
import { CreateXxxDto } from './dto/create-xxx.dto.js';
import { UpdateXxxDto } from './dto/update-xxx.dto.js';
import { FindXxxsDto } from './dto/find-xxxs.dto.js';
import { PageMetaDto } from '../../common/pagination/page-meta.dto.js';
import { PageDto } from '../../common/pagination/page.dto.js';
import { Prisma } from '@prisma/client';

@Injectable()
export class XxxsService {
  constructor(private readonly xxxsRepository: XxxsRepository) {}

  async create(createXxxDto: CreateXxxDto) {
    return this.xxxsRepository.create({
      ...createXxxDto,
      // si hay campos Decimal:
      // someAmount: new Prisma.Decimal(createXxxDto.someAmount),
    });
  }

  async findAll(query: FindXxxsDto) {
    const where: Prisma.XxxWhereInput = {};

    if (query.organizationId) where.organizationId = query.organizationId;
    if (query.name) where.name = { contains: query.name, mode: 'insensitive' };
    if (query.isActive !== undefined) where.isActive = query.isActive;

    const [items, count] = await this.xxxsRepository.findManyWithCount({
      where,
      skip: query.skip,
      take: query.limit,                                                         // ← query.limit, NO query.take
      orderBy: { [query.orderBy]: query.order.toLowerCase() as Prisma.SortOrder }, // ← .toLowerCase()
    });

    const pageMetaDto = new PageMetaDto({ itemCount: count, pageOptionsDto: query });
    return new PageDto(items, pageMetaDto);
  }

  async findOne(id: string) {
    const record = await this.xxxsRepository.findById(id);
    if (!record) throw new NotFoundException(`Xxx with ID ${id} not found`);
    return record;
  }

  async update(id: string, updateXxxDto: UpdateXxxDto) {
    await this.findOne(id);
    return this.xxxsRepository.update(id, updateXxxDto);
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.xxxsRepository.delete(id);
  }

  // Métodos extra opcionales:
  async toggleActive(id: string, isActive: boolean) {
    await this.findOne(id);
    return this.xxxsRepository.update(id, { isActive });
  }

  async addNote(id: string, notes: string) {
    const record = await this.findOne(id);
    const newNotes = record.notes ? `${record.notes}\n${notes}` : notes;
    return this.xxxsRepository.update(id, { notes: newNotes });
  }
}
```

---

## Paso 4 — Controller

**Reglas de seguridad por tipo de endpoint:**

| Tipo de ruta               | Guards                                    | Decoradores de rol                       |
|----------------------------|-------------------------------------------|------------------------------------------|
| Rutas de la organización   | `JwtAuthGuard`, `OrgRolesGuard`           | `@OrgRoles(Role.OWNER, Role.ADMINISTRATOR)` + `@ApiSecurity('x-organization-id')` |
| Ruta global para Admin     | `JwtAuthGuard`, `RolesGuard`              | `@Roles(GlobalRole.ADMIN)`               |

**Rate limiting:** El middleware global `RateLimitMiddleware` aplica automáticamente los perfiles según el método HTTP y si el usuario está autenticado. No requiere decoradores adicionales en el controlador.

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

  // --- RUTA GLOBAL ADMIN ---

  @Get('global/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.ADMIN)
  @ApiOperation({ summary: 'Get all globally (Global Admin)' })
  @ApiOkResponse({ type: PageDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findAllGlobal(@Query() findOptionsDto: FindXxxsDto) {
    return this.xxxsService.findAll(findOptionsDto);
  }
}
```

> [!WARNING]
> El endpoint `GET global/all` debe estar declarado **antes** del `GET :id` en el archivo, o de lo contrario NestJS interpretará `global` como un parámetro de ruta `:id`.

---

## Paso 5 — Module

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

## Paso 6 — Registrar en `app.module.ts`

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
- `[ ]` `create-xxx.dto.ts` con todos los campos y sus validaciones
- `[ ]` `update-xxx.dto.ts` usando `PartialType(OmitType(...))`
- `[ ]` `find-xxxs.dto.ts` extendiendo `PageOptionsDto`
- `[ ]` DTOs extra para operaciones puntuales (toggle, notes, etc.)
- `[ ]` `xxxs.repository.ts` con operaciones Prisma puras
- `[ ]` `xxxs.service.ts` con lógica y manejo de errores
- `[ ]` `xxxs.controller.ts` con guards correctos por endpoint
- `[ ]` `xxxs.module.ts` con todos los providers registrados
- `[ ]` Módulo importado en `app.module.ts`

---

## Errores comunes a evitar

| Error | Causa | Solución |
|---|---|---|
| `Property 'take' does not exist` | `PageOptionsDto` usa `limit` no `take` | Usar `query.limit` |
| `Decimal` no asignable | Campos monetarios deben convertirse | `new Prisma.Decimal(value)` |
| `SortOrder` inválido | Prisma espera minúsculas | `query.order.toLowerCase() as Prisma.SortOrder` |
| Ruta `global` resuelta como `:id` | Orden de declaración en controller | Declarar `GET global/all` **antes** de `GET :id` |
| `UpdateClientDto` no refleja en Swagger | Import desde `@nestjs/mapped-types` | Siempre importar `PartialType`/`OmitType` desde `@nestjs/swagger` |
