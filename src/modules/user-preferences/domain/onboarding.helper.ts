import { OnboardingGoal, OnboardingStep } from '@prisma/client';

/** Wizard order. Index in this array is the step's rank. */
export const ONBOARDING_STEP_ORDER: OnboardingStep[] = [
  OnboardingStep.GOAL,
  OnboardingStep.REGION,
  OnboardingStep.REMINDERS,
  OnboardingStep.DONE,
];

/**
 * Step progress is monotonic: a user who goes back to change their goal after
 * finishing the wizard must not be thrown back to step one.
 */
export function advanceStep(current: OnboardingStep, reached: OnboardingStep): OnboardingStep {
  const currentRank = ONBOARDING_STEP_ORDER.indexOf(current);
  const reachedRank = ONBOARDING_STEP_ORDER.indexOf(reached);
  return reachedRank > currentRank ? reached : current;
}

export interface OnboardingGoalOption {
  key: OnboardingGoal;
  label: string;
  description: string;
  icon: string;
}

/**
 * The fixed goal pool. Served from the API rather than duplicated in the
 * client so the copy has one home if it ever moves to a translation layer.
 */
export const ONBOARDING_GOALS: OnboardingGoalOption[] = [
  {
    key: OnboardingGoal.SAVE_MONEY,
    label: 'Ahorrar dinero en suscripciones',
    description: 'Detecta lo que pagas y no usas, y recorta lo que sobra.',
    icon: 'savings-rounded',
  },
  {
    key: OnboardingGoal.TRACK_SPENDING,
    label: 'Llevar seguimiento de mis gastos',
    description: 'Mira cuánto se te va cada mes y en qué categorías.',
    icon: 'insights-rounded',
  },
  {
    key: OnboardingGoal.MANAGE_FAMILY,
    label: 'Administrar suscripciones familiares',
    description: 'Ordena los planes compartidos y quién paga qué.',
    icon: 'family-restroom-rounded',
  },
  {
    key: OnboardingGoal.NEVER_MISS_RENEWAL,
    label: 'No dejar pasar una renovación',
    description: 'Recibe un aviso antes de cada cobro y de cada fin de prueba.',
    icon: 'notifications-active-rounded',
  },
];

/** Node 20+ ships the IANA database, so no extra dependency is needed. */
export function isValidTimezone(timezone: string): boolean {
  try {
    return Intl.supportedValuesOf('timeZone').includes(timezone);
  } catch {
    // Older runtimes without supportedValuesOf: fall back to a constructor probe.
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  }
}
