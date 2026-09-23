# Importación de maestros

El API expone un flujo común para cargar archivos `.xlsx` y `.csv` en los
maestros de clientes, proveedores, empleados, productos, insumos, categorías
de productos, categorías de gastos y categorías de transacciones.

Cada maestro ofrece:

* `GET /api/v1/{recurso}/import/template?format=xlsx|csv` para descargar la plantilla.
* `POST /api/v1/{recurso}/import/validate` con `multipart/form-data` (`file`) para validar sin escribir.
* `POST /api/v1/{recurso}/import` con `multipart/form-data` (`file`), `x-idempotency-key` y opcionalmente `x-import-file-hash` para confirmar.

Las rutas usan el permiso de creación del recurso (`clients:create`,
`products:create`, etc.) y el encabezado `x-organization-id`. La plantilla Excel
incluye las hojas `Datos` e `Instrucciones`; sus encabezados verdes son
obligatorios y los amarillos son opcionales. El CSV se entrega como UTF-8 con
BOM y separador punto y coma.

La validación devuelve el hash SHA-256 del archivo, conteos, una vista previa y
errores con fila, columna, código y mensaje. La confirmación vuelve a validar
el archivo y crea todas las filas en una transacción tenant-aware. Productos e
insumos reciben sus registros de stock iniciales en la misma transacción.

Se admiten hasta 1.000 filas y 10 MB. La operación solo crea registros nuevos;
las coincidencias por documento, SKU, código o las claves conservadoras de
cada maestro se reportan como duplicados. Las claves de idempotencia quedan
registradas en `import_records` para que un reintento seguro devuelva el mismo
resultado.
