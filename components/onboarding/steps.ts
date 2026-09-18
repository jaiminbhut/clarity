/** Page order for the single-screen onboarding flow and its progress bar. */
export const ONBOARDING_STEPS = ['name', 'accent', 'goal', 'priority', 'microphone'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];
