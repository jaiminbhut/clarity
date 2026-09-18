import { Slot } from 'expo-router';

/** One route owns every step; moving through setup never pushes a screen. */
export default function OnboardingLayout() {
  return <Slot />;
}
