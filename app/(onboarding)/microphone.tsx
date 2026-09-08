import { Mic01Icon, Shield01Icon, Tick02Icon, VoiceIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react-native';
import * as Haptics from 'expo-haptics';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Pressable, StyleSheet, View } from 'react-native';

import { OnboardingScreen } from '@/components/onboarding';
import { ThemedText } from '@/components/ui';
import { onboarding, spacing } from '@/constants/theme';
import { useMarkInteractive } from '@/hooks/use-mark-interactive';
import { useSetting } from '@/hooks/use-settings';
import { useTheme } from '@/hooks/use-theme';

type PermissionState =
  | 'checking'
  | 'undetermined'
  | 'granted'
  | 'blocked'
  | 'restricted'
  | 'simulated';

const SIMULATED_SPEECH =
  process.env.EXPO_PUBLIC_AUTOMATION === '1' &&
  process.env.EXPO_PUBLIC_MOCK_PRACTICE === '1';

const ROWS: { icon: IconSvgElement; text: string }[] = [
  { icon: Mic01Icon, text: 'Microphone, so Clarity can hear you read.' },
  { icon: VoiceIcon, text: 'Speech recognition, so it can follow the words and score them.' },
  { icon: Shield01Icon, text: 'Your recording is sent to a speech service to be scored.' },
];

/**
 * Step 5: the permission primer. Our screen explains; the system dialogs ask.
 *
 * Uses the COMBINED request, the same call the practice engine makes at session
 * start, so onboarding cannot grant a narrower set than the engine needs. iOS
 * shows two dialogs back to back; the copy says so.
 *
 * Completing onboarding never depends on a grant. A denial swaps the button to
 * Settings and leaves "Continue without it" underneath; the engine already
 * handles a refusal at first practice.
 */
export default function MicrophoneStep() {
  useMarkInteractive();
  const { colors } = useTheme();
  const [, setCompletedAt] = useSetting('onboardingCompletedAt');
  const [requesting, setRequesting] = useState(false);
  const requestInFlight = useRef(false);
  const [state, setState] = useState<PermissionState>(
    SIMULATED_SPEECH ? 'simulated' : 'checking',
  );
  const [available, setAvailable] = useState(true);
  const [writeFailed, setWriteFailed] = useState(false);

  useEffect(() => {
    // The simulator QA build never touches the native recognizer. Asking for a
    // permission it cannot use would put a system dialog back in front of the
    // deterministic practice fixture this profile exists to exercise.
    if (SIMULATED_SPEECH) return;
    let alive = true;
    const refresh = async () => {
      try {
        const recognitionAvailable = ExpoSpeechRecognitionModule.isRecognitionAvailable();
        const current = await ExpoSpeechRecognitionModule.getPermissionsAsync();
        if (alive) {
          setAvailable(recognitionAvailable);
          setState(classify(current));
        }
      } catch {
        if (alive) setState('undetermined');
      }
    };
    void refresh();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active' && !requestInFlight.current) void refresh();
    });
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);

  /**
   * The last step, and the only one whose write is load-bearing: the root guard
   * swaps this group for the tabs on `onboardingCompletedAt`, so nothing here
   * navigates. A failed write therefore left the CTA looking dead with nothing
   * said, and the note below is what says it. Pressing again retries.
   */
  const finish = () => setWriteFailed(!setCompletedAt(Date.now()));

  const request = async () => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setRequesting(true);
    try {
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      const next = classify(result);
      setState(next);
      if (next === 'granted') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      else if (next === 'blocked') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch {
      setState('undetermined');
    } finally {
      requestInFlight.current = false;
      setRequesting(false);
    }
  };

  const ready = state === 'granted' || state === 'simulated';

  const cta =
    ready
      ? { title: 'Explore my practice', action: finish }
      : state === 'blocked'
        ? { title: 'Open Settings', action: () => Linking.openSettings() }
        : state === 'restricted'
          ? { title: 'Continue', action: finish }
          : { title: 'Enable microphone & speech', action: request };

  const note = writeFailed
    ? 'Clarity could not finish setting up on this device. Tap again to retry.'
    : state === 'simulated'
      ? 'This simulator build uses scripted speech, so it does not need microphone access.'
      : !available
      ? 'Speech recognition is not available on this device. Simulators usually lack it. Try a physical device.'
      : state === 'blocked'
        ? 'Clarity cannot score a reading without the microphone. Turn it on in Settings whenever you are ready.'
        : state === 'restricted'
          ? 'Speech recognition is turned off by a restriction on this device. A parent or an administrator controls it.'
          : null;

  const footer =
    state === 'undetermined' || state === 'blocked' ? (
      <Pressable
        accessibilityRole="button"
        onPress={finish}
        disabled={requesting}
        style={({ pressed }) => [styles.textButton, { opacity: pressed ? onboarding.pressedOpacity : 1 }]}>
        <ThemedText variant="subhead" tone="secondary">
          {state === 'blocked' ? 'Continue without it' : 'Not now'}
        </ThemedText>
      </Pressable>
    ) : null;

  return (
    <OnboardingScreen
      title={ready ? 'Your practice is ready' : 'Let Clarity hear you'}
      subtitle={ready
        ? 'Start with a short passage or speak freely. Your first session is up to you.'
        : 'Enable your microphone and speech recognition to get feedback. Your device may ask for each separately.'}
      ctaTitle={requesting ? 'Waiting for permission…' : state === 'checking' ? 'Checking access…' : cta.title}
      onContinue={cta.action}
      ctaDisabled={state === 'checking' || requesting}
      note={note}
      footer={footer}>
      <View style={styles.rows}>
        {ROWS.map((row) => (
          <View key={row.text} style={styles.row}>
            <HugeiconsIcon icon={row.icon} size={onboarding.iconSize} color={colors.secondary} />
            <ThemedText variant="subheadProse" tone="secondary" style={styles.rowText}>
              {row.text}
            </ThemedText>
          </View>
        ))}
        {ready ? (
          <View style={styles.row}>
            <HugeiconsIcon icon={Tick02Icon} size={onboarding.iconSize} color={colors.accent} />
            <ThemedText variant="bodyProse" style={styles.rowText}>
              {state === 'simulated'
                ? 'Scripted speech is ready for simulator testing.'
                : 'Microphone and speech recognition are on.'}
            </ThemedText>
          </View>
        ) : null}
      </View>
    </OnboardingScreen>
  );
}

function classify(response: {
  granted: boolean;
  canAskAgain: boolean;
  restricted?: boolean;
}): PermissionState {
  if (response.granted) return 'granted';
  if (response.restricted) return 'restricted';
  return response.canAskAgain ? 'undetermined' : 'blocked';
}

const styles = StyleSheet.create({
  rows: {
    gap: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowText: {
    flex: 1,
  },
  textButton: {
    alignSelf: 'center',
    padding: spacing.md,
    marginTop: spacing.xs,
  },
});
