// Consolidate evidence without treating an outside-window result as proof of absence.
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'data', name), 'utf8'));
const universe = read('index-universe.json').indices;
const events = read('verified-events.json');
const followup = read('continued-audit-20261104.json');
const lookup = rows => new Map(rows.map(r => [r.ticker, r]));
const outside = lookup(followup.outsideWindow);
const unresolved = lookup(followup.unresolved);
const reviewed = lookup(followup.reviewedNoVerifiedNovemberEvent);
const schedules = {
  SSE: lookup(read('sse-schedule-audit.json').companies),
  N225: lookup(read('nikkei-schedule-audit.json').companies)
};
const result = {
  checkedOn: '2026-11-04', window: ['2026-11-02', '2026-11-29'],
  scope: 'Every constituent in the saved four-index roster has a screening record. This does not certify exhaustive earnings coverage: unresolved dates, stale roster risk, and filing versus release distinctions remain explicit.',
  indices: {}
};
for (const index of ['SSE', 'FTSE', 'CAC', 'N225']) {
  const companies = universe[index].constituents.map(c => {
    const ticker = c.Symbol;
    const confirmed = events.filter(e => e.ticker === ticker && e.date >= result.window[0] && e.date <= result.window[1]);
    let category, evidence;
    if (confirmed.length) { category = 'verified November event'; evidence = confirmed; }
    else if (unresolved.has(ticker)) { category = 'unresolved date or source access'; evidence = [unresolved.get(ticker)]; }
    else if (outside.has(ticker)) { category = 'periodic release outside window; other releases not excluded'; evidence = [outside.get(ticker)]; }
    else if (reviewed.has(ticker)) { category = 'reviewed; no verified November earnings event'; evidence = [reviewed.get(ticker)]; }
    else if (schedules[index]?.has(ticker)) {
      const schedule = schedules[index].get(ticker);
      if (!schedule.date) throw Error('Unresolved schedule lacks follow-up: ' + ticker);
      category = index === 'SSE' ? 'Q3 filing screened; other releases not excluded' : 'exchange schedule screened; other releases not excluded';
      evidence = [schedule];
    } else throw Error('Missing screening record: ' + ticker);
    return {ticker, name: c.Name, category, evidence};
  });
  const counts = companies.reduce((counts, c) => (counts[c.category] = (counts[c.category] || 0) + 1, counts), {});
  result.indices[index] = {rosterSource: universe[index].source, rosterQuality: universe[index].quality, total: companies.length, counts, companies};
}
fs.writeFileSync(path.join(root, 'data/four-index-audit-20261104.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(result.indices).map(([k,v]) => [k, {total:v.total, counts:v.counts}])), null, 2));
