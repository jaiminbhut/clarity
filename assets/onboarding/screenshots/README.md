# Welcome screenshots

Captured from Clarity's development account on the local iPhone 17 Pro Max simulator in light mode. These are real app views with development data. The reading session uses the app's existing simulator speech fixture.

- `session-light.jpg`: Calm Narration in progress.
- `results-light.jpg`: completed Calm Narration session.
- `analytics-light.jpg`: monthly speaking score and skills. Reused for the skills detail.
- `practice-light.jpg`: recommended practice, drills, and freestyle.
- `words-light.jpg`: the session's word breakdown.

Full-resolution originals are in `output/onboarding/captures/`. Bundled copies are 720 pixels wide, JPEG quality 88. No UI or scores were painted into them. The crop windows live in `onboarding.welcome.collage.crops`, exported through `constants/theme.ts`.

To refresh, capture these views in light mode at 440 × 956 points, then resize the full image to 720 pixels wide. Keep the full image aspect ratio; the component handles cropping.
