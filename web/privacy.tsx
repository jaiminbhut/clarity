import { LegalPage, type LegalSection } from '@/components/marketing/legal-page';

const SECTIONS: readonly LegalSection[] = [
  {
    heading: 'What Clarity collects',
    paragraphs: ['Clarity stores the following data for your account.'],
    bullets: [
      'Account: the name and email address your Apple or Google account shares with us, and an account ID from our sign-in provider, Clerk.',
      'Settings: the name you enter, your accent, your daily goal, your priority skill, and your data-use preference.',
      'Practice sessions: the date, duration, mode, scores, pace, filler count, word counts, the words you found hardest, per-word results, and completed personal feedback reports. Clarity does not archive your recordings on its servers.',
      'Custom passages: the title and text of any passage you add.',
      'Subscription status: whether you hold a Clarity Pro subscription, through RevenueCat.',
      'App diagnostics: launch times, navigation timing, session counts, and error reports through EAS Observe. These contain no passage text, transcripts, or recordings.',
    ],
  },
  {
    heading: 'How Clarity uses your recordings',
    paragraphs: [
      'When you practice, your device records your voice. Clarity uses the recording in three ways.',
    ],
    bullets: [
      'Speech recognition runs on your device when it can. When on-device recognition is not available, your device sends audio to Apple or Google speech services under their terms.',
      'When you request detailed feedback through Clarity Pro or a free feedback preview, the recording passes through our authenticated server to Microsoft Azure Speech for pronunciation, fluency, and supported prosody assessment. Clarity saves the assessment result, but does not archive the recording on its servers. Freestyle uses speech recognition and AI coaching rather than pronunciation assessment.',
      'The recording stays on your device so you can play it back on the results screen. It is removed when the device clears its cache.',
    ],
  },
  {
    heading: 'AI coaching',
    paragraphs: [
      'When you request personal coaching through Clarity Pro or a free feedback preview, Clarity sends your session statistics to our server. For freestyle sessions, this includes up to 1,200 characters of the words you spoke. Our server sends this data to Google Gemini through Vercel AI Gateway and saves the completed coaching report for your account. Difficult words can also be sent to generate practice passages or OpenAI model-pronunciation audio through the same gateway. Model-pronunciation clips are cached on our server and device for reuse. These providers do not receive your name, email, or account ID in the coaching or pronunciation request.',
    ],
  },
  {
    heading: 'Where your data lives',
    paragraphs: [
      'Your settings, sessions, and passages are stored on your device first and synced to Convex, our database provider, so they follow you between devices. Sign-in is handled by Clerk. Subscriptions are handled by Apple and RevenueCat. Clarity does not sell your data and does not use it for advertising.',
    ],
  },
  {
    heading: 'Your choices',
    paragraphs: ['You control your data from inside the app.'],
    bullets: [
      'Sign out removes your practice history from the device.',
      'Delete account, in Settings, removes your account and its practice data. We retain an opaque account-ID deletion marker to stop delayed requests from restoring deleted data. Shared model-pronunciation clips have no account ownership. Your recordings are not included in that shared cache.',
      'Turning off “Use my data to improve Clarity” in Settings stops optional app diagnostics from being sent. Essential processing, subscription verification, and server cost and security records still operate so the service can work.',
      'Microphone and speech recognition permissions can be changed at any time in your device settings. Without them, Clarity cannot score a session.',
      'You can manage or cancel Clarity Pro in your App Store account settings.',
    ],
  },
  {
    heading: 'Children',
    paragraphs: [
      'Clarity is not directed at children under 13 and does not knowingly collect data from them.',
    ],
  },
  {
    heading: 'Changes and contact',
    paragraphs: [
      'When this policy changes, the date at the top is updated. Questions about your data go to schroedernathan2011@icloud.com.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      metaDescription="How Clarity handles your voice recordings, practice data, and account."
      updated="September 8, 2026"
      intro="Clarity is a speech practice app made by Nathan Schroeder. This page explains what data Clarity collects, where it goes, and how to remove it."
      sections={SECTIONS}
    />
  );
}
