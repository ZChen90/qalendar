// GET /api/earnings — verified earnings release dates from the published calendar.
//
// The single source of truth is the week-data JSON embedded in index.html, the
// same data the website shows. This function reads the deployed page, flattens
// the weeks into a list of events and filters it. It never infers a date: a
// ticker without a verified event is reported in "noVerifiedDate".

const INDICES = ['SPX', 'NDX', 'HSI', 'DAX', 'FTSE', 'CAC', 'N225', 'KOSPI', 'SSE', 'W'];
const SESSIONS = ['pre', 'during', 'post', 'other'];
const TIME_ZONES = 'CET|CEST|UK|JST|HKT|KST|CST|ET';
const MAX_TICKERS = 50;

// --- Reading the published data -------------------------------------------

// Pulls the week-data JSON out of the page HTML. Throws if it is missing or broken.
export function extractWeekData(html) {
  const match = html.match(/<script type="application\/json" id="week-data">([\s\S]*?)<\/script>/);
  if (!match) throw new Error('week-data block not found');
  const data = JSON.parse(match[1]);
  if (!Array.isArray(data.weeks)) throw new Error('week-data has no weeks');
  return data;
}

// The calendar stores the release time inside the company name, in two styles:
// "HOCHTIEF (14:00 CET)" and "Nike · ~22:15 CET". A trailing " — text" is a note,
// e.g. "Kingfisher — Q3 trading update". This splits them into separate fields.
export function parseLabel(label) {
  let name = String(label || '').trim();
  let time = null, timezone = null, timeApproximate = false, note = null;
  const timePattern = new RegExp('\\s*(?:\\(|·\\s*)?(~)?(\\d{1,2}):(\\d{2})\\s*(' + TIME_ZONES + ')\\b\\)?');
  const found = name.match(timePattern);
  if (found) {
    timeApproximate = Boolean(found[1]);
    time = found[2].padStart(2, '0') + ':' + found[3];
    timezone = found[4];
    name = name.replace(found[0], '').trim();
  }
  const dash = name.indexOf(' — ');
  if (dash > 0) {
    note = name.slice(dash + 3).trim() || null;
    name = name.slice(0, dash).trim();
  }
  return { name, note, time, timezone, timeApproximate };
}

// Turns weeks → days → sessions into one flat, sorted list of events.
export function flattenEvents(data) {
  const events = [];
  for (const week of data.weeks) {
    for (const day of week.days || []) {
      for (const session of SESSIONS) {
        for (const item of day[session] || []) {
          const label = parseLabel(item.n);
          events.push({
            ticker: item.t,
            name: label.name,
            date: day.date,
            session,
            time: label.time,
            timezone: label.timezone,
            timeApproximate: label.timeApproximate,
            note: label.note,
            indices: Array.isArray(item.idx) ? item.idx : item.idx ? [item.idx] : [],
            source: item.source || null,
            verifiedOn: item.verifiedOn || null,
          });
        }
      }
    }
  }
  const order = s => SESSIONS.indexOf(s);
  return events.sort((a, b) =>
    a.date.localeCompare(b.date) || order(a.session) - order(b.session) || a.ticker.localeCompare(b.ticker));
}

// First and last calendar date the published data covers, or null if it is empty.
export function publishedWindow(data) {
  const dates = data.weeks.flatMap(w => (w.days || []).map(d => d.date)).sort();
  return dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null;
}

// --- Reading the request ----------------------------------------------------

export function berlinDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

function isRealDate(text) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const d = new Date(text + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === text;
}

function list(value) {
  return [...new Set(String(value).split(',').map(s => s.trim().toUpperCase()).filter(Boolean))];
}

// Validates the query string. Returns {query} or {error, message}.
export function parseQuery(params) {
  const query = { tickers: null, indices: null, from: null, to: null };
  if (params.has('ticker')) {
    const tickers = list(params.get('ticker'));
    if (!tickers.length || tickers.length > MAX_TICKERS || tickers.some(t => !/^[A-Z0-9.\-]{1,12}$/.test(t)))
      return { error: 'invalid_ticker', message: 'ticker: 1 to ' + MAX_TICKERS + ' comma-separated symbols, e.g. ticker=ADI,SAP.DE' };
    query.tickers = tickers;
  }
  if (params.has('index')) {
    const indices = list(params.get('index'));
    if (!indices.length || indices.some(i => !INDICES.includes(i)))
      return { error: 'invalid_index', message: 'index: one or more of ' + INDICES.join(', ') };
    query.indices = indices;
  }
  for (const key of ['from', 'to']) {
    if (!params.has(key)) continue;
    if (!isRealDate(params.get(key))) return { error: 'invalid_date', message: key + ': a calendar date as YYYY-MM-DD' };
    query[key] = params.get(key);
  }
  if (query.from && query.to && query.from > query.to)
    return { error: 'invalid_range', message: 'from must not be later than to' };
  return { query };
}

// --- Answering --------------------------------------------------------------

export function filterEvents(events, query, range) {
  return events.filter(e =>
    e.date >= range.from && e.date <= range.to &&
    (!query.tickers || query.tickers.includes(e.ticker)) &&
    (!query.indices || e.indices.some(i => query.indices.includes(i))));
}

const json = (body, status, cache) => Response.json(body, {
  status,
  headers: { 'Cache-Control': cache, 'Content-Type': 'application/json; charset=utf-8' },
});

// loadPage returns a Response with the deployed index.html; now is injectable for tests.
export async function handleEarnings(request, loadPage, now = new Date()) {
  const parsed = parseQuery(new URL(request.url).searchParams);
  if (parsed.error) return json({ error: parsed.error, message: parsed.message }, 400, 'no-store');
  const query = parsed.query;

  let data;
  try {
    const page = await loadPage();
    if (!page.ok) throw new Error('page unavailable');
    data = extractWeekData(await page.text());
  } catch {
    // Never answer with an empty success when the data could not be read.
    return json({ error: 'data_unavailable', message: 'The published calendar could not be read. Try again later.' }, 503, 'no-store');
  }

  const today = berlinDate(now);
  const window = publishedWindow(data);
  // Default range: today (Berlin) to the end of the published window.
  const range = { from: query.from || today, to: query.to || (window ? window.to : today) };
  const events = filterEvents(flattenEvents(data), query, range);
  const found = new Set(events.map(e => e.ticker));
  const published = (String(data.updatedAt || '').match(/^\d{4}-\d{2}-\d{2}/) || [null])[0];
  const twoDaysAgo = new Date(new Date(today + 'T00:00:00Z').getTime() - 2 * 86400000).toISOString().slice(0, 10);

  return json({
    updatedAt: data.updatedAt || null,
    stale: !published || published < twoDaysAgo,
    window,
    range,
    coverage: {
      complete: false,
      note: 'Only release dates confirmed by an issuer or exchange are listed. A missing company means no verified date, not no earnings.',
      source: data.source || null,
    },
    count: events.length,
    events,
    noVerifiedDate: query.tickers ? query.tickers.filter(t => !found.has(t)) : [],
  }, 200, 'public, max-age=300');
}

export const onRequestGet = ({ request, env }) =>
  handleEarnings(request, () => env.ASSETS.fetch(new URL('/', request.url)));
