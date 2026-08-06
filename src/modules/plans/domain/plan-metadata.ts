import { Prisma } from '@prisma/client';

export interface PlanMetadata {
  maxUsers: number | null;
  includesAllModules: boolean;
  trialDays?: number;
  isTrial?: boolean;
}

const DEFAULT_PLAN_LIMITS: PlanMetadata = {
  maxUsers: null,
  includesAllModules: true,
};

/**
 * Reads Plan.metadata safely. Plans created before this feature (or via
 * find-or-create fallbacks) may have null metadata — default to unlimited
 * users / all modules rather than silently locking the organization out.
 */
export function getPlanLimits(metadata: Prisma.JsonValue | null | undefined): PlanMetadata {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return DEFAULT_PLAN_LIMITS;
  }

  const raw = metadata as Record<string, unknown>;
  return {
    maxUsers: typeof raw.maxUsers === 'number' ? raw.maxUsers : DEFAULT_PLAN_LIMITS.maxUsers,
    includesAllModules:
      typeof raw.includesAllModules === 'boolean'
        ? raw.includesAllModules
        : DEFAULT_PLAN_LIMITS.includesAllModules,
    trialDays: typeof raw.trialDays === 'number' ? raw.trialDays : undefined,
    isTrial: typeof raw.isTrial === 'boolean' ? raw.isTrial : undefined,
  };
}
