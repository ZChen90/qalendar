# Calendar updates

The page derives its rolling four-week view from the viewer's local date. Weeks run Monday through Sunday; the board displays Monday through Friday. On Monday, an open page returns to the new current week. Daily clock checks also refresh the Today marker.

While visible, the page fetches the published HTML every five minutes and on focus, pageshow, network recovery and returning to a visible tab. Only the embedded week-data JSON is adopted. Fetches bypass the browser cache, time out after 15 seconds, and preserve the last known data on errors or invalid responses. Older snapshots cannot overwrite newer ones. Filters and saved lists stay in localStorage.

The browser does not discover new earnings announcements. Publication is a separate process. Data older than two calendar days (using the Berlin publication date) is flagged. Missing weeks show an unavailable-data message; no earnings are inferred or copied into new dates.

The replacement Codex automation is named Qalendar daily earnings update and is scheduled for 07:58 Europe/Berlin on weekdays. Its first run must verify existing seeded records, current listings and memberships. It must retain source evidence, distinguish announcement times from conference calls, preserve UI code, and never advance updatedAt without actual verification. This is a local Codex automation, not an always-on market-data feed. Disable the previous Claude task to avoid competing publishers.

The GitHub connector returned a write-permission error during setup. The existing authenticated gh/git CLI on the owner's Mac is the working publication route. GitHub main deploys to Cloudflare Pages automatically.

## Verification

Run from the repository root with Node.js:

```
node --test tests/calendar.test.cjs
node tests/validate.cjs index.html
```

The regression suite covers the reported October 29 date error, Sunday/Monday rollover, exhausted data and year boundaries, stale-data messaging, successful refresh with preserved lists/week selection, invalid/offline refreshes, and rejecting older snapshots. Run with TZ=Europe/Berlin, TZ=America/Los_Angeles and TZ=Asia/Tokyo for local-calendar checks.

## Market-wide company search

Search accepts company names and ticker symbols, independent of index filters and earnings coverage. Cloudflare Pages serves `/api/search` from `functions/api/search.js`; `_routes.json` limits function invocation to that endpoint. Deploy the repository root, including functions, through Pages.

The endpoint queries Yahoo Finance and filters equity results to US, Hong Kong, German, UK, French, Japanese, Korean and mainland Chinese exchanges. Numeric queries also try market suffixes. Up to 50 matches are returned per query; this is broad provider-backed lookup, not an exhaustive exchange security master. Availability, name languages, instrument classification and coverage depend on the provider. Exact symbols with market suffixes are the most reliable query. No API key is embedded.

Local aliases remain available offline. Loading, partial failures and unavailable searches are displayed explicitly. Selecting a result preserves its exact ticker; it does not switch to another listing or invent earnings dates or index membership. Only known index memberships are shown; unknown membership and missing-earnings messages are omitted from search suggestions. Explicitly named warrants and issuer-confirmed CRMLW warrants are excluded from company-share search results. Company-name input is not saved as a made-up ticker.

Search validation: `node --test tests/*.test.cjs` and `node tests/validate.cjs index.html`. Browser verification must include CRML by ticker and Critical Metals by name, selecting the listing and adding it to a list.

## November 4 coverage update

The board now supports Monday–Sunday data, including an optional `other` array for confirmed dates without a confirmed pre/post-market release session. Search, reminders and calendar export include that array. Calendar exports remain all-day events.

`data/index-universe.json` is the reviewed roster snapshot and per-company earnings-review checklist. `scripts/sync-universe.cjs` reconciles the embedded directory to those reviewed rosters without advancing freshness. `data/verified-events.json` contains source-backed additions; `scripts/import-verified-events.cjs` is a one-time November 4 snapshot importer, not an unattended date generator. Review new evidence before changing its date or inputs.

The coverage panel distinguishes roster size from companies with known release dates and explicitly identifies incomplete KOSPI verification and partial earnings coverage. Secondary rosters are labeled. The earlier weekday-only/schema restriction above is superseded by this user-authorized update.
