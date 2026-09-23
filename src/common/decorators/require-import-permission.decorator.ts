import { SetMetadata } from '@nestjs/common';

export const REQUIRE_IMPORT_PERMISSION_KEY = 'require_import_permission';
export const RequireImportPermission = () => SetMetadata(REQUIRE_IMPORT_PERMISSION_KEY, true);
