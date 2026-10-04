# Gigzy authentication UI

The landing, sign-in, sign-up, role selection and password reset screens use a warm white and teal theme. Shared components live in `components/auth/AuthUI.tsx`; their colour and form tokens live in `constants/authTheme.ts`.

Phones use a small photo banner and a scrollable form. Screens at least 900px wide use a photo/story column beside the form. Inputs have visible labels and focus borders; password visibility, loading states, error announcements and role selection are included. The sign-up button scrolls with the form so it stays reachable when a keyboard is open.

The existing Firebase handlers, stored account roles, password requirements and registration preferences are retained. The sign-in screen's create-account link now goes to role selection. Signed-in app screens share the same palette through `constants/theme.ts`. Authentication aliases these shared tokens. Status bar text is dark throughout the light app.

## Image asset

Saved asset: `assets/images/auth/gigzy-cafe-hero.png`.

Generated using the built-in imagegen tool under the imagegen skill, then copied into the project. The original is retained in the generator output directory. The image is bundled locally and reused across the authentication flow; no remote image service is needed.

Final generation prompt:

> Use case: editorial lifestyle photography. Asset type: a bundled hero photo for Gigzy, a youth and local-business gig marketplace mobile app. Create one photorealistic landscape 3:2 photograph of two Sri Lankan young adults, clearly ages 20-25, a woman and a man, collaborating with a female small cafe owner in her 30s at a bright neighborhood cafe in Colombo. One young adult is arranging a coffee order, another is discussing a notebook with the owner; natural candid warmth, authentic working moment, relaxed smart casual clothes in muted sage, cream and terracotta, no uniforms or visible brands. Scene: sunlit cafe with pale plaster walls, wood counter, leafy plant, subtle teal details. Composition: medium-wide waist-up scene; all faces and main action contained in central 65% so the photo also crops well into a portrait mobile card; main subjects near the middle, uncluttered light background. Lighting: soft daylight, true skin texture, editorial quality, friendly and credible, low contrast, warm white/forest teal palette. No text, no logos, no watermarks, no UI, no collage, no illustrated look, no exaggerated poses.

## Verification

TypeScript, lint for the changed screens/components, and Expo web export are the build checks. Browser checks cover the five screens at 320px, 390px and 1440px widths, local photo loading, horizontal overflow, empty sign-in validation, password visibility and the terms checkbox. Preview screenshots are in the ignored `.expo/auth-ui/` folder.

Before release, check on a phone that the on-screen keyboard allows scrolling to each field and the submit button. This UI change does not create test accounts or send live password-reset emails.
