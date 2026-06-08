import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { PERMISSIONS_CATALOG } from './seed/permissions.catalog.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL env variable is missing');

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding permissions catalog...\n');

  let modulesUpserted = 0;
  let featuresUpserted = 0;
  let permissionsUpserted = 0;

  for (const moduleDef of PERMISSIONS_CATALOG) {
    const module = await prisma.module.upsert({
      where: { key: moduleDef.key },
      update: {
        name: moduleDef.name,
        description: moduleDef.description ?? null,
        icon: moduleDef.icon ?? null,
        sortOrder: moduleDef.sortOrder ?? 0,
        isActive: true,
      },
      create: {
        key: moduleDef.key,
        name: moduleDef.name,
        description: moduleDef.description ?? null,
        icon: moduleDef.icon ?? null,
        sortOrder: moduleDef.sortOrder ?? 0,
        isActive: true,
      },
    });

    modulesUpserted++;
    console.log(`  ✅ Module: ${module.name} (${module.key})`);

    for (const featureDef of moduleDef.features) {
      const feature = await prisma.feature.upsert({
        where: { key: featureDef.key },
        update: {
          name: featureDef.name,
          description: featureDef.description ?? null,
          sortOrder: featureDef.sortOrder ?? 0,
          isActive: true,
          moduleId: module.id,
        },
        create: {
          key: featureDef.key,
          name: featureDef.name,
          description: featureDef.description ?? null,
          sortOrder: featureDef.sortOrder ?? 0,
          isActive: true,
          moduleId: module.id,
        },
      });

      featuresUpserted++;
      console.log(`    ✅ Feature: ${feature.name} (${feature.key})`);

      for (const permDef of featureDef.permissions) {
        await prisma.permission.upsert({
          where: { key: permDef.key },
          update: {
            name: permDef.name,
            description: permDef.description ?? null,
            type: permDef.type,
            sortOrder: permDef.sortOrder ?? 0,
            isActive: true,
            featureId: feature.id,
          },
          create: {
            key: permDef.key,
            name: permDef.name,
            description: permDef.description ?? null,
            type: permDef.type,
            sortOrder: permDef.sortOrder ?? 0,
            isActive: true,
            featureId: feature.id,
          },
        });

        permissionsUpserted++;
        console.log(`      ✅ Permission: ${permDef.name} (${permDef.key})`);
      }
    }
  }

  console.log('\n🌱 Initializing modules for existing organizations...');
  const organizations = await prisma.organization.findMany();
  const activeModules = await prisma.module.findMany({ where: { isActive: true } });

  let orgsInitialized = 0;
  for (const org of organizations) {
    const assignedCount = await prisma.organizationModule.count({
      where: { organizationId: org.id },
    });

    if (assignedCount > 0) {
      console.log(`  ⚠️ Organization '${org.name}' already has modules initialized. Skipping.`);
      continue;
    }

    console.log(`  🚀 Initializing modules for organization '${org.name}'...`);
    await prisma.organizationModule.createMany({
      data: activeModules.map((m) => ({
        organizationId: org.id,
        moduleId: m.id,
      })),
    });
    orgsInitialized++;
  }

  console.log('\n🌱 Wiring default permissions for OWNER and ADMINISTRATOR roles in all organizations...');
  const allOrgs = await prisma.organization.findMany();
  const allPermissions = await prisma.permission.findMany({ where: { isActive: true } });

  let rolesWired = 0;
  for (const org of allOrgs) {
    const roles = await prisma.role.findMany({
      where: { organizationId: org.id },
    });

    const ownerRole = roles.find((r) => r.name === 'OWNER');
    const adminRole = roles.find((r) => r.name === 'ADMINISTRATOR');

    if (ownerRole) {
      const exists = await prisma.rolePermission.count({
        where: { roleId: ownerRole.id },
      });
      if (exists === 0) {
        console.log(`  🔑 Wiring OWNER role permissions for organization '${org.name}'...`);
        await prisma.rolePermission.createMany({
          data: allPermissions.map((p) => ({
            roleId: ownerRole.id,
            permissionId: p.id,
            organizationId: org.id,
          })),
        });
        rolesWired++;
      }
    }

    if (adminRole) {
      const exists = await prisma.rolePermission.count({
        where: { roleId: adminRole.id },
      });
      if (exists === 0) {
        console.log(`  🔑 Wiring ADMINISTRATOR role permissions for organization '${org.name}'...`);
        await prisma.rolePermission.createMany({
          data: allPermissions
            .filter((p) => !p.key.startsWith('organization_users:'))
            .map((p) => ({
              roleId: adminRole.id,
              permissionId: p.id,
              organizationId: org.id,
            })),
        });
        rolesWired++;
      }
    }
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Seed completed:
   Modules:     ${modulesUpserted}
   Features:    ${featuresUpserted}
   Permissions: ${permissionsUpserted}
   Orgs Init:   ${orgsInitialized}
   Roles Wired: ${rolesWired}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
