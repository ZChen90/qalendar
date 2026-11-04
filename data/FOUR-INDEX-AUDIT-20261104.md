# Four-index screening — 4 November 2026

Window: **2–29 November 2026**. KOSPI is independent of this work.

Published additions: **23 FTSE 100 events**, with issuer/exchange or issuer-distributed regulatory sources. No release session was inferred from a presentation time.

| Saved roster | Securities screened | Verified November events | Other findings |
|---|---:|---:|---|
| SSE Composite | 2,233 | 3 filing events | 2,230 outside-window Q3 issuer filing records |
| FTSE 100 | 100 | 48 | 40 outside-window periodic releases; 4 reviewed without a verified November earnings event; 8 unresolved dates |
| CAC 40 | 40 | 7 | 33 outside-window periodic releases |
| Nikkei 225 | 225 | 151 | 73 outside-window schedule/issuer results; Mercari unresolved |

Machine-readable evidence for every security is in `four-index-audit-20261104.json`. This is complete **screening of the saved rosters**, not certification that every possible November release is known. FTSE/CAC rosters retain their documented secondary-source limitation. An October result does not exclude an additional trading update in November.

## Source/date exceptions

- **Mercari (4385.T):** issuer IR returns HTTP 403; alternative IRpocket search returned prior-year reports. Unverified November 4 date withheld.
- **easyJet (EZJ.L):** issuer calendar and results pages expose empty dynamic content; direct retrieval also returned HTTP 403. Secondary November 25 / December 1 dates conflict.
- **M&G (MNG.L):** issuer calendar and IR return HTTP 403; November 5 has secondary support only.
- **Polar Capital Technology Trust (PCT.L):** issuer pages return a generic dynamic shell, including its document library. Polar Capital Holdings is a different company and its date must not be substituted.
- **Prudential plc (PRU.L):** reopened issuer calendar exposes August results only; earlier November candidate could not be reproduced. Do not substitute US Prudential Financial.
- **Scottish Mortgage (SMT.L):** issuer confirms May/November reporting months but an exact November 2026 publication date was not found. November 24 investor event excluded.
- **BAE Systems (BA.L):** current calendar has July results and a December dividend; its November 12 update is explicitly from 2025.
- **Ithaca (ITH.L):** current issuer calendar explicitly lists no upcoming events; no exact Q3 date established.
- **Games Workshop (GAW.L):** official trading-statement archive checked; no current November publication date established.

Centrica and BAT have outside-window half-year results recorded but no verified later trading-update date. BAT's current calendar also returned HTTP 403. These findings must not be interpreted as proof that they have no November update.

## Exchange-schedule limits

SSE: all 2,233 securities now have issuer-level Q3 filing records. The final 37 B-share rows are linked to A-share records by exact normalized issuer name in the official constituent roster. This does not independently establish the B-share publication time or the issuer's first earnings-release time. Separate releases remain possible.

Nikkei: September, August, and next-day JPX schedules were reconciled without date conflicts. Issuer follow-ups resolve Kubota, Bandai Namco, and Sekisui House; Mercari remains unresolved. Schedule files retain source URLs and hashes in the audit data.

The date exceptions above need accessible primary evidence before adding calendar entries. They do not prevent publication of the verified events.
