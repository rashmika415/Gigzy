# Language support

Gigzy offers English, Sinhala and Tamil. Choose a language on the welcome or authentication screens, or in Profile. The interface updates immediately and the preference is saved on this device with AsyncStorage (`gigzy.language`). At startup a saved preference wins; otherwise the first supported device language is used, with English as the fallback.

Translations are bundled in `locales/en.json`, `locales/si.json` and `locales/ta.json`, so changing language does not need a network request. `localization/LanguageProvider.tsx` restores preferences before displaying the app. A failed save keeps the selected language active and shows a retry message beside the selector. A later device-language change is picked up on the next startup when no manual preference is saved.

## Adding or editing copy

Use `useTranslation()` from `react-i18next` and `t('English source text')` for interface copy. English text is the exact lookup key, including punctuation. Add the same key to all three JSON files. For dynamic copy use named interpolation arguments, for example `t('Mapped gigs: {{count}}', { count })`. Translate complete phrases so each language can choose its own word order. Keep interpolation names identical across languages.

Use `Text` and `TextInput` from `components/LocalizedText.tsx` for application screens. They select bundled Noto Sinhala/Tamil fonts and suitable line spacing. `localization/format.ts` formats dates, times, numbers and relative dates using the active locale. Calendar dates remain local dates so switching languages or timezones does not move a gig to a different day. Date/time input formats remain `YYYY-MM-DD` and `HH:MM` for validation and storage. Currency amounts retain the existing currency; choosing a language does not convert money.

Store existing role, status, category and location-type values unchanged. Translate their display labels. Keep user-entered names, gig titles, descriptions, skills, addresses, reviews and chat messages in their original language. Quick-reply templates use the selected language when sent, and the resulting stored message remains unchanged afterward. Notification titles/bodies supplied by the backend remain in their supplied language; localized notification generation would require coordination with that backend.

Map controls, grouped-pin labels and meeting-point accessibility labels are translated. Map tiles and provider attribution come from Geoapify/OpenStreetMap and retain their original language. Where the platform lacks Sinhala Intl date data, bundled month labels are used. Relative dates also use bundled translations when `Intl.RelativeTimeFormat` is missing (including Hermes in Expo Go on iPhone/Android), lacks locale data, or throws while formatting.

## Validation

Run `npm test`, `npx tsc --noEmit` and `npx eslint app components localization`. Localization tests check language precedence, dictionary coverage, placeholder consistency, runtime switching and fallback behavior. Native export checks validate bundling; test the language selector, Sinhala/Tamil text and keyboard behavior on Android/iOS devices before release. Have fluent Sinhala and Tamil speakers review the bundled wording before publishing.

Future screens should use the same provider and dictionaries. No Firebase schema migration or additional API key is required.

Browser verification with fixture accounts covered profile, discovery and posting at 320, 390 and 1440 pixels, plus welcome, login and youth registration at 390 pixels. Checks verified all three languages, persistence across page reloads, original gig content, Sinhala date fallback and preservation of typed login input during a language change. Real account creation and physical-device keyboard behavior were not exercised by these fixture checks.
