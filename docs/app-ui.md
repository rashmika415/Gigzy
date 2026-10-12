# Gigzy shared light theme

All implemented app screens inherit the warm-white, teal and mint palette from `constants/theme.ts`. Authentication uses aliases to the same tokens. Cards, inputs, selected controls, status labels, messaging bubbles, modal surfaces and the tab bar use colors suitable for a light background. Dark decorative glows are removed. Native appearance and splash background use the light theme; those config changes require a new native build.

Home has separate photos for youth and business accounts. My Gigs and Post a Gig use a compact business banner. Gig lists retain compact cards; profile photos, logos and chat attachments remain user supplied. The youth banner adapts to a horizontal layout on desktop. Home shows the stored profile rating and labels its recent-feed totals as listed gigs and pay, rather than personal earnings.

## Bundled images

- `assets/images/app/creative-work.png`: youth home banner.
- `assets/images/app/local-business.png`: business home and compact business banners.

Created with the imagegen skill and tool, then copied into this repository. Originals remain in the generated-images directory. No external image URL is required.

Final youth image prompt:

> Use case: photorealistic-natural. Asset type: bundled dashboard banner for Gigzy, a Sri Lankan local youth gig app. A warm editorial landscape 3:2 photograph of two Sri Lankan young adults clearly ages 20-25 collaborating on a creative freelance project at a sunlit neighborhood shared workspace. One woman using a laptop and a man arranging printed design swatches on a pale wooden desk, natural candid concentration and smiles, casual muted sage and cream clothes. Both faces and laptop contained within central 65 percent, medium-wide composition that crops into a short horizontal banner. Warm white plaster wall, leafy plant, subtle muted teal decor, soft natural daylight, true skin texture. Authentic and approachable, professional photography. No text, no branding, no watermark, no UI, no collage.

Final business image prompt:

> Use case: photorealistic-natural. Asset type: bundled business dashboard banner for Gigzy, a Sri Lankan local gig marketplace. One warm editorial landscape 3:2 photograph of a Sri Lankan female small-business owner in her 30s and a Sri Lankan young male adult clearly age 22-25 preparing kraft-paper customer packages together at a sunlit neighborhood plant and homewares shop. They are talking naturally while one folds a box and the other checks a notebook. Medium-wide composition, faces and hands in the central 65 percent so this crops to a short horizontal banner. White plaster, pale wood, leafy plants, restrained terracotta details and teal apron. Soft daylight, credible candid moment, realistic skin and hands, inviting warm-white and teal palette. No text, logos, watermark, UI or collage.

## Verification

TypeScript and Expo web export pass. Browser previews use an isolated copy under the ignored `.expo/app-ui/preview` directory with local fixtures and mock subscription services. No authentication bypass or preview data is included in the app source. Screenshots are saved under `.expo/app-ui/`.

Checks cover home for both roles, browse, My Gigs, messages, both profiles, profile editing, posting, notifications, gig details, public profiles and chat at 320px, 390px and 1440px. Local images load and there is no page-level horizontal overflow or uncaught runtime exception. The authentication checks also pass. These checks verify presentation, not live Firebase mutations or native phone keyboards.

Full app lint has existing effect-related errors in Home, Messages and Edit Profile, plus existing hook/unused-variable warnings. These are outside the theme change; the new banner and shared theme files pass lint.
