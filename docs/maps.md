# Browse map

Browse now offers List and Map views using the same search, filters and loaded pages. Native maps show open, on-site and hybrid gigs with valid coordinates. Tap a pin to open the gig detail; when several gigs share coordinates, choose a gig from the location sheet. The sheet also supports saving gigs.

Refresh and Load more fetch results through the existing discovery hook. The map covers loaded results, not every gig in the database. Remote gigs and gigs without coordinates remain accessible in List. My location requests foreground permission on demand; permission or GPS failures leave the gig pins usable. Show all pins fits the camera to the loaded locations.

## Geoapify setup

Posting an on-site or hybrid gig now supports Geoapify address search on web and mobile. Search returns up to five address choices; selecting one fills the address and meeting-point coordinates. Use my location or tap/drag the map pin for an exact meeting point. Coordinates remain available behind a manual-entry toggle. Address changes clear the previous point and cancel stale searches while keeping the map document open. Gig details show the saved meeting point on a read-only map, including for closed gigs with coordinates; remote gigs have no meeting-point map.

The app uses Geoapify raster tiles with Leaflet 1.9.4. Android and iOS render through `react-native-webview`; web uses an isolated iframe. Google Maps SDKs and keys are no longer used.

1. Set `EXPO_PUBLIC_GEOAPIFY_API_KEY` in the gitignored `.env` and build environment. See `.env.example`. This client-side key is included in the app bundle.
2. Configure access restrictions and monitor usage in Geoapify. Domain/referrer restrictions must allow the web deployment; verify native WebView restrictions separately because inline HTML has no normal website origin.
3. Restart Expo with `npx expo start --clear` after changing the key. Existing standalone apps need a rebuild to include WebView; Expo Go already includes it. EAS builds need the environment variable too.
4. Gigs need valid latitude and longitude coordinates to appear on the map.

Geoapify and OpenStreetMap attribution stays visible. Internet access is required for tiles and the pinned Leaflet CDN assets. Failed tile or script loads show a retry state; List remains available.

See [Geoapify map tiles](https://apidocs.geoapify.com/docs/maps/map-tiles/) and [Expo SDK 57 WebView](https://docs.expo.dev/versions/v57.0.0/sdk/webview/). The repository-required [SDK 54 documentation](https://docs.expo.dev/versions/v54.0.0/) was also reviewed.

## Validation

Unit tests cover coordinate validation, remote/closed gig exclusion, overlapping pins, HTML injection protection, bridge commands and events, tile failure handling and app configuration without Google plugins. Browser checks use actual Geoapify tiles and verify attribution, pin-to-detail navigation and layouts at 320, 390 and 1440 pixels. The supplied key returned a successful PNG response. Native WebView rendering and location permission prompts still need verification on a device.

No new Firestore collections, indexes or rules are required: the map reads the existing discovery results and gig coordinates.
