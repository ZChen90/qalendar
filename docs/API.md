# Qalendar API

## GET /api/earnings

Verified earnings release dates from the published calendar. No key is needed. The data is the same data the website shows, refreshed once every trading-day morning (Europe/Berlin).

Coverage is partial. Only dates confirmed by an issuer or an exchange are listed, so a company that is missing has **no verified date** — that does not mean it has no earnings.

### Parameters

All parameters are optional and can be combined.

| Parameter | Meaning | Example |
|---|---|---|
| `ticker` | 1 to 50 symbols, comma-separated, case-insensitive. Non-US listings carry a market suffix. | `ticker=ADI,SAP.DE,7203.T` |
| `index` | One or more of `SPX`, `NDX`, `HSI`, `DAX`, `FTSE`, `CAC`, `N225`, `KOSPI`, `SSE`, `W` (owner watch list). | `index=DAX,CAC` |
| `from`, `to` | Inclusive date range, `YYYY-MM-DD`. | `from=2026-11-24&to=2026-11-30` |

Without `from`, the range starts today (Europe/Berlin). Without `to`, it ends on the last published day.

### Response

```json
{
  "updatedAt": "2026-11-23 08:58 (Berlin)",
  "stale": false,
  "window": { "from": "2026-11-23", "to": "2026-12-20" },
  "range": { "from": "2026-11-24", "to": "2026-12-20" },
  "coverage": { "complete": false, "note": "…", "source": "…" },
  "count": 1,
  "events": [
    {
      "ticker": "ADI",
      "name": "Analog Devices",
      "date": "2026-11-24",
      "session": "pre",
      "time": "13:00",
      "timezone": "CET",
      "timeApproximate": false,
      "note": null,
      "indices": ["SPX", "NDX"],
      "source": "https://www.analog.com/…",
      "verifiedOn": "2026-11-12"
    }
  ],
  "noVerifiedDate": ["SAP.DE"]
}
```

| Field | Meaning |
|---|---|
| `updatedAt` | When the calendar was last verified and published. |
| `stale` | `true` when `updatedAt` is more than two days old. |
| `window` | First and last day the published calendar covers. |
| `range` | The date range this answer covers. |
| `events[].session` | `pre`, `during` or `post` relative to the company's home market; `other` when the date is confirmed but the time of day is not. |
| `events[].time`, `timezone` | Release clock time when the issuer states one, otherwise `null`. Zones: `ET`, `CET`, `CEST`, `UK`, `HKT`, `JST`, `KST`, `CST` (China). |
| `events[].note` | Extra label such as "Q3 trading update", otherwise `null`. |
| `events[].source` | The page that confirms the date. |
| `events[].verifiedOn` | The day that source was checked. |
| `noVerifiedDate` | Requested tickers with no verified event in the range. |

Events are sorted by date, then session, then ticker.

### Errors

| Status | `error` | When |
|---|---|---|
| 400 | `invalid_ticker`, `invalid_index`, `invalid_date`, `invalid_range` | A parameter is malformed; `message` says which. |
| 503 | `data_unavailable` | The published calendar could not be read. An empty result is never returned in its place. |

Successful answers are cached for five minutes.
