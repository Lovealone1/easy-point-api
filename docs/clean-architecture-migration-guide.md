# 🔄 Guía de Migración: Clean Architecture para Módulos Existentes

> Este documento describe cómo migrar los módulos existentes al nuevo patrón de
> Clean Architecture con entidad de dominio.
>
> **Módulo de referencia:** `supplies` — ya migrado, úsalo como guía visual.
> **Guía para módulos nuevos:** [`crud-module-guide.md`](./crud-module-guide.md)

---

## ¿Por qué migrar?

El patrón anterior (Controller → Service → Repository) no definía una capa de dominio:

| Problema | Impacto |
|---|---|
| Lógica de negocio en el service (concatenar notas, calcular precios) | El service mezcla orquestación con dominio; difícil de testear |
| Lógica de negocio en el repository (`calcPricePerUnit`) | El repositorio sabe demasiado; viola Single Responsibility |
| Tipos Prisma (`Supply`, `Client`) expuestos en todas las capas | Acoplamiento a la infraestructura en la capa de aplicación |
| Sin entidad central | Imposible añadir invariantes de negocio sin tocar múltiples capas |

---

## Estado de migración por módulo

| Módulo | Entidad | Repository retorna entidad | Service solo orquesta | Estado |
|--------|---------|---------------------------|----------------------|--------|
| `supplies` | ✅ `domain/supply.entity.ts` | ✅ | ✅ | **✅ Migrado** |
| `suppliers` | ❌ | ❌ | ❌ | 🔴 Pendiente |
| `clients` | ❌ | ❌ | ❌ | 🔴 Pendiente |
| `employees` | ❌ | ❌ | ❌ | 🔴 Pendiente |
| `product-categories` | ❌ | ❌ | ❌ | 🔴 Pendiente |
| `organizations` | ❌ | ❌ | ❌ | 🔴 Pendiente |
| `organization-users` | ❌ | ❌ | ❌ | 🔴 Pendiente |
| `invitations` | ❌ | ❌ | ❌ | 🔴 Pendiente |
| `auth` | — | — | — | ⏸ No aplica (sin entidad propia) |

---

## Proceso de migración paso a paso

### Checklist por módulo

```
- [ ] Paso 1: Identificar la lógica de negocio existente
- [ ] Paso 2: Crear la entidad de dominio en domain/
- [ ] Paso 3: Actualizar el repository para retornar entidades
- [ ] Paso 4: Simplificar el service a solo orquestación
- [ ] Paso 5: Verificar que el build pasa sin errores
```

---

## Paso 1 — Identificar la lógica de negocio

Antes de tocar código, busca en el **service** y el **repository** del módulo:

| ¿Qué buscar? | Ejemplo | Dónde mover |
|---|---|---|
| Concatenaciones o transformaciones de texto | `notes ? notes + '\n' + new : new` | Método en la entidad |
| Cálculos con campos del modelo | `basePrice / packageSize` | Método en la entidad |
| Validaciones de estado de negocio | `if (supply.isActive) throw...` | Método en la entidad |
| Construcción de valores derivados | `creditLimit - usedCredit` | Propiedad o método calculado |

---

## Paso 2 — Crear la entidad de dominio

Crea `src/modules/{nombre}/domain/{nombre}.entity.ts`.

### Template base (módulos simples — sin campos calculados)

```typescript
// domain/client.entity.ts
export class ClientEntity {
  readonly id: string;
  name: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  notes: string | null;
  readonly organizationId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  // ... todos los campos del modelo

  constructor(params: { /* todos los campos */ }) {
    Object.assign(this, params);
  }

  // Solo los métodos de negocio que tienen lógica real:
  appendNote(note: string): void {
    this.notes = this.notes ? `${this.notes}\n${note}` : note;
  }

  static fromPrisma(raw: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    isActive: boolean;
    notes: string | null;
    organizationId: string;
    createdAt: Date;
    updatedAt: Date;
  }): ClientEntity {
    return new ClientEntity(raw);
  }
}
```

### Template con campos calculados (como `supplies`)

```typescript
// domain/supply.entity.ts (ya implementado — úsalo como referencia)
// Ver: src/modules/supplies/domain/supply.entity.ts
```

> [!TIP]
> Para módulos simples sin lógica de negocio no trivial, el `constructor` puede usar
> `Object.assign(this, params)` para simplificar el código. Para entidades complejas
> con invariantes, inicializar campo a campo (como en `SupplyEntity`).

---

## Paso 3 — Actualizar el Repository

**Cambios necesarios:**

1. Importar la entidad: `import { XxxEntity } from './domain/xxx.entity.js'`
2. Cambiar todos los tipos de retorno de `Xxx` (Prisma) a `XxxEntity`
3. Envolver cada resultado con `XxxEntity.fromPrisma(raw)` o `rows.map(XxxEntity.fromPrisma)`
4. Eliminar cualquier lógica de negocio que haya (moverla a la entidad)

### Antes (patrón v1)

```typescript
import { Prisma, Client } from '@prisma/client';

async create(data: Prisma.ClientUncheckedCreateInput): Promise<Client> {
  return this.prisma.client.create({ data });
}

async findById(id: string): Promise<Client | null> {
  return this.prisma.client.findUnique({ where: { id } });
}

async findManyWithCount(...): Promise<[Client[], number]> {
  return Promise.all([
    this.prisma.client.findMany(...),
    this.prisma.client.count(...),
  ]);
}

async update(id: string, data: ...): Promise<Client> {
  return this.prisma.client.update({ where: { id }, data });
}

async delete(id: string): Promise<Client> {
  return this.prisma.client.delete({ where: { id } });
}
```

### Después (patrón v2 — Clean Architecture)

```typescript
import { Prisma } from '@prisma/client';
import { ClientEntity } from './domain/client.entity.js';

async create(data: Prisma.ClientUncheckedCreateInput): Promise<ClientEntity> {
  const raw = await this.prisma.client.create({ data });
  return ClientEntity.fromPrisma(raw);
}

async findById(id: string): Promise<ClientEntity | null> {
  const raw = await this.prisma.client.findUnique({ where: { id } });
  return raw ? ClientEntity.fromPrisma(raw) : null;
}

async findManyWithCount(...): Promise<[ClientEntity[], number]> {
  const [rows, count] = await Promise.all([
    this.prisma.client.findMany(...),
    this.prisma.client.count(...),
  ]);
  return [rows.map(ClientEntity.fromPrisma), count];
}

async update(id: string, data: ...): Promise<ClientEntity> {
  const raw = await this.prisma.client.update({ where: { id }, data });
  return ClientEntity.fromPrisma(raw);
}

async delete(id: string): Promise<ClientEntity> {
  const raw = await this.prisma.client.delete({ where: { id } });
  return ClientEntity.fromPrisma(raw);
}
```

> [!NOTE]
> El import de `{ Client }` de `@prisma/client` desaparece del repository. Solo queda `Prisma`
> (para los tipos de input/where/orderBy). El modelo de dominio es ahora `ClientEntity`.

---

## Paso 4 — Simplificar el Service

**Cambios necesarios:**

1. Cambiar tipos de retorno a `XxxEntity` o `PageDto<XxxEntity>`
2. Importar la entidad
3. En `addNote`: quitar la concatenación del service, delegarla a `entity.appendNote(note)`
4. En `update` con invariantes: pasar la entidad actual al repository

### Antes — `addNote` con lógica en el service

```typescript
async addNote(id: string, notes: string) {
  const record = await this.findOne(id);
  // ❌ Lógica de negocio en el service
  const newNotes = record.notes ? `${record.notes}\n${notes}` : notes;
  return this.xxxsRepository.update(id, { notes: newNotes });
}
```

### Después — `addNote` delegando a la entidad

```typescript
async addNote(id: string, note: string): Promise<XxxEntity> {
  const entity = await this.findOne(id);
  // ✅ La entidad aplica su lógica
  entity.appendNote(note);
  return this.xxxsRepository.update(id, { notes: entity.notes }, entity);
}
```

### Antes — `toggleActive` con lógica mezclada

```typescript
async toggleActive(id: string, isActive: boolean) {
  await this.findOne(id);
  return this.xxxsRepository.update(id, { isActive });
}
```

### Después — no hay cambio lógico, solo tipos explícitos

```typescript
async toggleActive(id: string, isActive: boolean): Promise<XxxEntity> {
  const current = await this.findOne(id);
  return this.xxxsRepository.update(id, { isActive }, current);
}
```

---

## Paso 5 — Verificar el build

```bash
npm run build
```

Errores comunes de TypeScript durante la migración:

| Error | Causa | Solución |
|---|---|---|
| `Type 'Client' is not assignable to type 'ClientEntity'` | Repository todavía retorna tipo Prisma | Aplicar `.fromPrisma()` en todos los métodos del repository |
| `Property 'xxx' does not exist on type 'ClientEntity'` | Campo faltante en la entidad | Añadir el campo al constructor y al `fromPrisma()` |
| `Argument of type 'ClientEntity' is not assignable` | Repository update no acepta entidad | Añadir `currentEntity: XxxEntity` como parámetro |
| `Cannot find module './domain/xxx.entity.js'` | Falta la extensión `.js` en el import | Usar siempre `.js` aunque el archivo sea `.ts` (regla del proyecto) |

---

## Referencia: diff completo de `supplies`

### Repository — qué se eliminó / modificó

```diff
- import { Prisma, Supply } from '@prisma/client';
+ import { Prisma } from '@prisma/client';
+ import { SupplyEntity } from './domain/supply.entity.js';

- private calcPricePerUnit(
-   basePrice: Prisma.Decimal,
-   packageSize: Prisma.Decimal,
- ): Prisma.Decimal {
-   return basePrice.div(packageSize);   // ❌ lógica de negocio en repository
- }

- async create(...): Promise<Supply> {
+ async create(...): Promise<SupplyEntity> {
-   return this.prisma.supply.create({ data: { ...data, pricePerUnit } });
+   const entity = SupplyEntity.fromPrisma({ ...data, pricePerUnit: new Prisma.Decimal(0), ... });
+   entity.applyPriceChange();            // ✅ entidad aplica el invariante
+   const raw = await this.prisma.supply.create({ data: { ...data, pricePerUnit: entity.pricePerUnit } });
+   return SupplyEntity.fromPrisma(raw);

- async findById(id: string): Promise<Supply | null> {
+ async findById(id: string): Promise<SupplyEntity | null> {
-   return this.prisma.supply.findUnique({ where: { id } });
+   const raw = await this.prisma.supply.findUnique({ where: { id } });
+   return raw ? SupplyEntity.fromPrisma(raw) : null;
```

### Service — qué se eliminó

```diff
- async addNote(id: string, notes: string) {
-   const supply = await this.findOne(id);
-   const newNotes = supply.notes ? `${supply.notes}\n${notes}` : notes;  // ❌ lógica en service
-   return this.suppliesRepository.update(id, { notes: newNotes }, supply);

+ async addNote(id: string, note: string): Promise<SupplyEntity> {
+   const supply = await this.findOne(id);
+   supply.appendNote(note);              // ✅ entidad aplica la lógica
+   return this.suppliesRepository.update(id, { notes: supply.notes }, supply);
```

---

## Orden recomendado de migración

Priorizar módulos con más lógica de negocio:

1. **`clients`** — tiene lógica de concatenación de notas + campos monetarios (`creditLimit`, `balance`)
2. **`suppliers`** — similar a clients, lógica de notas
3. **`employees`** — campos de salario/comisión
4. **`product-categories`** — relativamente simple, buen módulo de práctica
5. **`organizations`** / **`organization-users`** — más sensibles, migrar con cuidado
6. **`invitations`** — lógica de negocio compleja (estado, expiración), dejar para cuando tengas experiencia con el patrón

> [!TIP]
> Migra un módulo a la vez y verifica con `npm run build` entre cada uno. No migres
> en paralelo para evitar conflictos difíciles de rastrear.
