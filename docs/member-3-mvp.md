# Member 3 MVP

Implemented in the order of the assigned scope:

1. **Browse feed:** cursor pagination, pull to refresh, load more, end-of-results state, deduplication, and cancellation when filters change.
2. **Gig details:** live document subscription, working retry, deleted-gig state, business profile link, date/time and distance display. Filled/closed gigs have no open-gig action bar.
3. **Keyword search:** case-insensitive matching across title, description, category, skills and location. All words must match; searching traverses older pages.
4. **Filters:** category (supports IDs and existing names), remote/on-site/hybrid, minimum/maximum pay, rate type, distance radius, available dates, local start times, and weekends.
5. **Indexes:** status/date ascending and descending, status/pay/date in both pay directions, and status/application-count/date. Existing owner and category indexes remain.
6. **Distance:** foreground device location and Haversine straight-line distances. New on-site/hybrid posts capture coordinates using address lookup, current location, or manual entry.
7. **Shared UI:** gig card, status pill, form field, chips, segmented control, shared tab bar, discovery filters and gig-location field.
8. **States:** initial loading, pagination loading, empty results, partial searches, retryable errors, permission failures and unavailable coordinates.
9. **Navigation:** protected youth Browse and business My Gigs routes, shared safe-area-aware tab bar, and gig/profile stack navigation.

## Query behaviour

Firestore reads only open gigs in the selected sort order. Search and other filters run on each retrieved batch to support substring matching and legacy category names. An interaction scans at most five batches of 30 documents. If no match is found but more records exist, **Continue searching** advances the cursor. Matching batches can return more than 20 gigs to avoid dropping documents. This MVP approach scans records; a dedicated search index and geospatial query system can reduce reads as the catalogue grows.

Remote gigs remain visible for any distance radius. Older on-site gigs without coordinates are excluded when a radius is set and show distance as unavailable. Their business owner must add `coordinates: { latitude, longitude }` to make them discoverable by distance. A time filter excludes gigs without a start time. Dates use `YYYY-MM-DD` and start times use local `HH:MM`; overnight windows are not supported.

## Shared contracts

- Youth role: `freelancer`; business role: `client`.
- Gig categories accept a category ID or display name. Newly created documents also store a canonical `categoryId`.
- Gig coordinates: `{ latitude: number, longitude: number }`.
- Optional gig start time: `time: "HH:MM"`.
- Shared status display supports `open`, `filled`, `closed`, `completed`, plus legacy `in-progress` and `cancelled`. Member 2 owns lifecycle transitions.
- Member 4 owns the application screen and application list. Connect those routes when implemented; this change does not create application records or placeholder routes.

## Setup

Run `npm install` to install the added Expo-compatible location package. The repository currently uses SDK 57; location APIs were checked against the required SDK 54 documentation before implementation, and Expo selected the dependency version for the installed SDK.

Rebuild native development builds to apply the location permission configuration. Only foreground location is requested. Address lookup uses the native geocoder; web users can enter coordinates manually or use browser geolocation.

Deploy the updated indexes to the intended Firebase project and wait until they finish building:

```sh
firebase deploy --only firestore:indexes --project local-workers-74bdd
```

The implementation does not deploy indexes or modify live Firestore data.

## Validation

```sh
npx tsc --noEmit
node --test tests/gig-feed.test.cjs tests/discovery.test.cjs
npx expo export --platform web
```

Device checks before demo:

- Log in as youth; confirm Browse is available and My Gigs is protected. Reverse this for a business account, including direct links.
- Post an on-site gig with coordinates and a start time. Confirm the category, date/time and distance filters find it.
- Test location permission granted and denied, unavailable GPS, address lookup, and manual coordinates.
- Load multiple pages, search for an older gig, refresh after posting, and retry after restoring network connectivity.
- Close or fill a gig while its detail screen is open; confirm the status updates. Delete it and confirm the unavailable-gig state.

The web export also fixes the existing Firebase initialization problem: native persistence is used on mobile, web auth is initialized separately, and Expo public environment variables use static property access.
