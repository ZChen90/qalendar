const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const load = () => import('data:text/javascript;base64,' + Buffer.from(fs.readFileSync(path.join(__dirname, '../functions/api/earnings.js'), 'utf8')).toString('base64'));

// Synthetic fixture: tests must not depend on the data published today.
const FIXTURE = {
  updatedAt: '2026-11-23 08:58 (Berlin)',
  source: 'synthetic fixture; partial coverage',
  weeks: [
    { weekLabel: 'Nov 23 – Nov 29, 2026', days: [
      { date: '2026-11-23', weekday: 'Mon', pre: [], post: [{ t: 'A', n: 'Agilent Technologies', idx: ['SPX'], source: 'https://example.com/a', verifiedOn: '2026-11-22' }], other: [] },
      { date: '2026-11-24', weekday: 'Tue',
        pre: [{ t: 'ADI', n: 'Analog Devices · 13:00 CET', idx: ['SPX', 'NDX'], source: 'https://example.com/adi', verifiedOn: '2026-11-12' }],
        during: [{ t: 'HOT.DE', n: 'HOCHTIEF (14:00 CET)', idx: ['DAX'], source: 'https://example.com/hot', verifiedOn: '2026-11-05' }],
        post: [],
        other: [{ t: 'KGF.L', n: 'Kingfisher — Q3 trading update', idx: ['FTSE'], source: 'https://example.com/kgf', verifiedOn: '2026-11-20' }] },
    ] },
    { weekLabel: 'Nov 30 – Dec 6, 2026', days: [
      { date: '2026-12-02', weekday: 'Wed', pre: [], post: [{ t: 'CRM', n: 'Salesforce', idx: 'SPX', source: 'https://example.com/crm', verifiedOn: '2026-11-11' }], other: [] },
      { date: '2026-12-06', weekday: 'Sun', pre: [], post: [], other: [] },
    ] },
  ],
};
const page = (data = FIXTURE) => async () => new Response('<html><script type="application/json" id="week-data">\n' + JSON.stringify(data) + '\n</script><script type="application/json" id="dir">[]</script></html>');
const NOW = new Date('2026-11-24T10:00:00+01:00');
async function call(queryString, loadPage = page(), now = NOW) {
  const { handleEarnings } = await load();
  const response = await handleEarnings(new Request('https://qalendar.app/api/earnings' + queryString), loadPage, now);
  return { response, body: await response.json() };
}

test('time and note are split out of the stored company label', async () => {
  const { parseLabel } = await load();
  assert.deepEqual(parseLabel('HOCHTIEF (14:00 CET)'), { name: 'HOCHTIEF', note: null, time: '14:00', timezone: 'CET', timeApproximate: false });
  assert.deepEqual(parseLabel('Analog Devices · 13:00 CET'), { name: 'Analog Devices', note: null, time: '13:00', timezone: 'CET', timeApproximate: false });
  assert.deepEqual(parseLabel('Nike · ~22:15 CET'), { name: 'Nike', note: null, time: '22:15', timezone: 'CET', timeApproximate: true });
  assert.deepEqual(parseLabel('Kingfisher — Q3 trading update'), { name: 'Kingfisher', note: 'Q3 trading update', time: null, timezone: null, timeApproximate: false });
  assert.deepEqual(parseLabel('Shell (7:00 UK)').time, '07:00');
  assert.equal(parseLabel('Brown & Brown').name, 'Brown & Brown');
});

test('default range starts today in Berlin and ends with the published window', async () => {
  const { response, body } = await call('');
  assert.equal(response.status, 200);
  assert.deepEqual(body.range, { from: '2026-11-24', to: '2026-12-06' });
  assert.deepEqual(body.window, { from: '2026-11-23', to: '2026-12-06' });
  assert.deepEqual(body.events.map(e => e.ticker), ['ADI', 'HOT.DE', 'KGF.L', 'CRM']); // A (Nov 23) is in the past
  assert.equal(body.count, 4);
  assert.equal(body.stale, false);
  assert.equal(body.coverage.complete, false);
});

test('Berlin date, not UTC date, decides what "today" is', async () => {
  // 23:30 UTC on Nov 23 is already Nov 24 in Berlin.
  const { body } = await call('', page(), new Date('2026-11-23T23:30:00Z'));
  assert.equal(body.range.from, '2026-11-24');
});

test('events carry session, time, indices, source and verification date', async () => {
  const { body } = await call('?ticker=hot.de');
  assert.deepEqual(body.events, [{ ticker: 'HOT.DE', name: 'HOCHTIEF', date: '2026-11-24', session: 'during', time: '14:00', timezone: 'CET', timeApproximate: false, note: null, indices: ['DAX'], source: 'https://example.com/hot', verifiedOn: '2026-11-05' }]);
});

test('tickers without a verified event are reported, never given a guessed date', async () => {
  const { body } = await call('?ticker=ADI,SAP.DE,NVDA');
  assert.deepEqual(body.events.map(e => e.ticker), ['ADI']);
  assert.deepEqual(body.noVerifiedDate, ['SAP.DE', 'NVDA']);
});

test('index filter accepts several tags and a string idx in the data', async () => {
  assert.deepEqual((await call('?index=NDX')).body.events.map(e => e.ticker), ['ADI']);
  assert.deepEqual((await call('?index=dax,ftse')).body.events.map(e => e.ticker), ['HOT.DE', 'KGF.L']);
  assert.deepEqual((await call('?index=SPX')).body.events.map(e => e.ticker), ['ADI', 'CRM']);
});

test('date range is inclusive and can reach back inside the published window', async () => {
  assert.deepEqual((await call('?from=2026-11-23&to=2026-11-23')).body.events.map(e => e.ticker), ['A']);
  assert.deepEqual((await call('?from=2026-12-02&to=2026-12-02')).body.events.map(e => e.ticker), ['CRM']);
  assert.equal((await call('?from=2027-01-01&to=2027-01-31')).body.count, 0);
});

test('filters combine', async () => {
  const { body } = await call('?index=SPX&from=2026-11-25&ticker=ADI,CRM');
  assert.deepEqual(body.events.map(e => e.ticker), ['CRM']);
  assert.deepEqual(body.noVerifiedDate, ['ADI']);
});

test('invalid parameters return 400 with the reason', async () => {
  for (const [qs, error] of [['?ticker=', 'invalid_ticker'], ['?ticker=AB CD', 'invalid_ticker'], ['?ticker=' + Array.from({ length: 51 }, (_, i) => 'T' + i).join(','), 'invalid_ticker'],
    ['?index=DOW', 'invalid_index'], ['?from=2026-13-01', 'invalid_date'], ['?to=2026-02-30', 'invalid_date'], ['?from=24.11.2026', 'invalid_date'], ['?from=2026-12-02&to=2026-12-01', 'invalid_range']]) {
    const { response, body } = await call(qs);
    assert.equal(response.status, 400, qs);
    assert.equal(body.error, error, qs);
  }
});

test('unreadable data returns 503, never an empty success', async () => {
  for (const loadPage of [async () => new Response('', { status: 500 }), async () => new Response('<html>no data</html>'), async () => new Response('<script type="application/json" id="week-data">{broken</script>'), async () => { throw new Error('offline'); }]) {
    const { response, body } = await call('', loadPage);
    assert.equal(response.status, 503);
    assert.equal(body.error, 'data_unavailable');
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  }
});

test('data older than two days is flagged as stale', async () => {
  const { body } = await call('', page({ ...FIXTURE, updatedAt: '2026-11-20 08:00 (Berlin)' }));
  assert.equal(body.stale, true);
});

test('works against the calendar actually embedded in index.html', async () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const { extractWeekData, flattenEvents } = await load();
  const events = flattenEvents(extractWeekData(html));
  for (const e of events) {
    assert.match(e.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(e.ticker && e.name, 'ticker and name present');
    assert.doesNotMatch(e.name, /\d{1,2}:\d{2}/, 'time removed from name: ' + e.name);
  }
});
