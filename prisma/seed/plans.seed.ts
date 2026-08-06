import { PrismaClient } from '@prisma/client';
import type { PlanMetadata } from '../../src/modules/plans/domain/plan-metadata.js';

interface PlanSeedDef {
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  metadata: PlanMetadata;
}

export const PLANS_CATALOG: PlanSeedDef[] = [
  {
    name: 'FREE',
    description: 'Prueba gratuita de 7 días con acceso completo a todos los módulos.',
    monthlyPrice: 0,
    yearlyPrice: 0,
    metadata: { maxUsers: 3, includesAllModules: true, trialDays: 7, isTrial: true },
  },
  {
    name: 'BASIC',
    description: 'Plan Basic — hasta 10 usuarios, todos los módulos incluidos.',
    monthlyPrice: 99000,
    yearlyPrice: 990000,
    metadata: { maxUsers: 10, includesAllModules: true },
  },
  {
    name: 'PREMIUM',
    description: 'Plan Premium — usuarios ilimitados, todos los módulos incluidos.',
    monthlyPrice: 249000,
    yearlyPrice: 2490000,
    metadata: { maxUsers: null, includesAllModules: true },
  },
];

export async function seedPlans(prisma: PrismaClient) {
  console.log('\n🌱 Seeding plans catalog (FREE / BASIC / PREMIUM)...');

  let plansUpserted = 0;
  for (const planDef of PLANS_CATALOG) {
    const plan = await prisma.plan.upsert({
      where: { name: planDef.name },
      update: {
        description: planDef.description,
        monthlyPrice: planDef.monthlyPrice,
        yearlyPrice: planDef.yearlyPrice,
        currency: 'COP',
        isActive: true,
        metadata: planDef.metadata as any,
      },
      create: {
        name: planDef.name,
        description: planDef.description,
        monthlyPrice: planDef.monthlyPrice,
        yearlyPrice: planDef.yearlyPrice,
        currency: 'COP',
        isActive: true,
        metadata: planDef.metadata as any,
      },
    });
    plansUpserted++;
    console.log(`  ✅ Plan: ${plan.name}`);
  }

  return plansUpserted;
}
