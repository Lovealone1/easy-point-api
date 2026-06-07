# Guía de Cableado (Wiring) del Sistema de Permisos

Esta documentación describe cómo integrar, registrar y auditar los permisos en el backend (`easy-point-api`) y frontend (`easy-point-ui`).

---

## 1. Definición en el Catálogo de Semilla (Seed)

El catálogo canónico se encuentra en [permissions.catalog.ts](file:///c:/Users/dgo34/Desktop/easy-point/easy-point-api/prisma/seed/permissions.catalog.ts).

Para registrar nuevos módulos, features o permisos, agrega la definición respectiva respetando los siguientes tipos:

### Estructura de Objetos

* **ModuleDef**: Módulo de alto nivel (ej. Ventas, Inventario).
  * `key`: Identificador único (ej. `sales`, `inventory`).
  * `name`: Nombre legible para la UI.
  * `icon`: Nombre del icono Lucide (ej. `ShoppingCart`, `Package`).
  * `sortOrder`: Orden de visualización en el menú/checklist.
* **FeatureDef**: Agrupación funcional dentro del módulo (ej. Gestión de Ventas, Reportes).
  * `key`: Identificador único concatenado (ej. `sales.management`, `sales.reports`).
  * `permissions`: Listado de permisos asociados a esta feature.
* **PermissionDef**: Acción granular (ej. Crear venta, Ver costos).
  * `key`: Identificador único en formato `modulo:accion` (ej. `sales:create`, `products:view_cost`).
  * `type`: Categoría del permiso, definida por el enum `PermissionType`:
    * `CRUD`: Operaciones básicas de creación, lectura, actualización y borrado.
    * `ACTION`: Acciones especiales de lógica de negocio (cancelar, aprobar, exportar).
    * `VIEW`: Visibilidad de datos sensibles o campos específicos.
    * `UI`: Flags específicos para habilitar elementos de la interfaz.

---

## 2. Cableado en Controladores del Backend

Para proteger un endpoint con el sistema de permisos granulares, debes decorar tus métodos o clases en los controladores de NestJS utilizando `PermissionsGuard` y `@RequirePermission()`.

### Paso a Paso

1. **Importar Decoradores y Guards**:

   ```typescript
   import { UseGuards } from '@nestjs/common';
   import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
   import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
   import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
   ```

2. **Configurar Guards a Nivel Clase**:

   Los controladores deben usar `JwtAuthGuard` primero para inyectar el token decodificado de usuario en la petición, seguido de `PermissionsGuard`:

   ```typescript
   @UseGuards(JwtAuthGuard, PermissionsGuard)
   @Controller('sales')
   export class SalesController { ... }
   ```

3. **Proteger Endpoints Individuales**:

   Aplica el decorador `@RequirePermission('key:permiso')` especificando la key correspondiente del catálogo de permisos:

   ```typescript
   @Post()
   @RequirePermission('sales:create')
   async create(@Body() createDto: CreateSaleDto) {
     return this.salesService.create(createDto);
   }

   @Get()
   @RequirePermission('sales:read')
   async findAll() {
     return this.salesService.findAll();
   }
   ```

> [!IMPORTANT]
> Si no decoras un endpoint con `@RequirePermission`, el `PermissionsGuard` permitirá el paso por defecto (no aplica restricción granular, solo autenticación por `JwtAuthGuard`).

---

## 3. Lógica de Bypass en Runtime

`PermissionsGuard` realiza las siguientes comprobaciones de acceso en orden de prioridad:

1. **Global Admin (`GlobalRole.ADMIN`)**: Bypass total automático. Accede a cualquier ruta.
2. **Roles de Sistema de Organización (`OWNER` y `ADMINISTRATOR`)**: Bypass total automático dentro de la organización.
3. **Roles Custom de Organización**: El guard consulta en base de datos si el rol custom del usuario dentro de la organización actual tiene asignado explícitamente el `key` requerido en la tabla `role_permissions`.

---

## 4. Cableado en el Frontend (UI)

Para restringir visualizaciones o comportamientos en el cliente React/Next.js:

1. **Consumir mis permisos**:

   Al iniciar la aplicación, realiza un fetch a:
   `GET /permissions/my-permissions` (con la cabecera `x-organization-id` de la org actual).
   El endpoint devolverá:

   ```json
   {
     "permissions": ["sales:create", "sales:read"],
     "isSystemRole": false
   }
   ```

   *(Si es un rol con bypass como Owner/Administrator, retornará `"permissions": ["*"]` e `isSystemRole: true`).*

2. **Guardar en Estado Global (Context/Redux)**:

   Almacena `permissions` e `isSystemRole` en el estado global.

3. **Uso en Componentes**:

   Crea un Helper o Hook `usePermission` para condicionar renderizados de elementos visuales (ej. ocultar un botón de eliminación):

   ```tsx
   const canDelete = usePermission('sales:delete');
   
   return (
     {canDelete && <Button onClick={handleDelete}>Eliminar Venta</Button>}
   );
   ```

---

## 5. Actualización del Catálogo en DB

Cada vez que agregues o modifiques un permiso en [permissions.catalog.ts](file:///c:/Users/dgo34/Desktop/easy-point/easy-point-api/prisma/seed/permissions.catalog.ts), puedes sincronizar tu base de datos local y remota ejecutando:

```bash
pnpm prisma db seed
```

El script de semilla (`seed.ts`) utiliza la operación `upsert` para que la actualización sea segura: no alterará ni duplicará permisos existentes ni afectará las asignaciones previas de roles custom.

---

## 6. Creación de Roles de Sistema por Organización

Para garantizar la existencia de los roles de sistema en cada organización creada:

* Cuando se crea un nuevo tenant (Organización) a través de `OrganizationsRepository.create()`, se insertan automáticamente los roles `OWNER` y `ADMINISTRATOR` en la base de datos de manera anidada.
* Estos roles se configuran con `isSystemDefault: true`, lo que asegura el bypass automático del guard de seguridad (`PermissionsGuard`).
