#!/usr/bin/env node
/*
 * Qalendar data validator — run after every manual edit of index.html, before pushing.
 *   node tools/validate.js [path/to/index.html]
 * Exits 0 and prints "ALL CHECKS PASSED" when the embedded data is well-formed.
 */
const fs = require("fs");
const path = process.argv[2] || require("path").join(__dirname, "..", "index.html");
const s = fs.readFileSync(path, "utf8");

const IDX = ["SPX","NDX","HSI","DAX","FTSE","CAC","N225","KOSPI","SSE","W"];
const TZ = ["ET","CET","CEST","UK","HKT","JST","KST","CST"];
const errors = [];
const warn = [];

function block(id) {
  const m = s.match(new RegExp('<script type="application/json" id="' + id + '">\\n([\\s\\S]*?)\\n</script>'));
  if (!m) { errors.push("missing <script id=\"" + id + "\"> block"); return null; }
  try { return JSON.parse(m[1]); }
  catch (e) { errors.push(id + " is not valid JSON: " + e.message); return null; }
}

// ---- week-data ----
const data = block("week-data");
if (data) {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2} \(Berlin\)$/.test(data.updatedAt || ""))
    warn.push('updatedAt should look like "2026-10-21 16:30 (Berlin)" — got: ' + data.updatedAt);
  if (!Array.isArray(data.weeks) || data.weeks.length < 1) errors.push("weeks[] missing or empty");
  if (Array.isArray(data.weeks) && data.weeks.length !== 4) warn.push("expected 4 weeks, got " + data.weeks.length);
  (data.weeks || []).forEach((w, wi) => {
    if (!Array.isArray(w.days)) { errors.push("week " + wi + ": days[] missing"); return; }
    if (w.days.length !== 5) warn.push("week " + wi + ": expected 5 days (Mon-Fri), got " + w.days.length);
    w.days.forEach((d, di) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date || "")) errors.push("week " + wi + " day " + di + ": bad date " + d.date);
      for (const sess of ["pre", "post"]) (d[sess] || []).forEach(c => {
        const where = w.weekLabel + " " + d.date + " " + sess + " " + c.t;
        if (!c.t || !/^[A-Z0-9.\-]+$/.test(c.t)) errors.push("bad ticker at " + where);
        if (!c.n) errors.push("missing company name at " + where);
        (c.idx || []).forEach(x => { if (!IDX.includes(x)) errors.push("unknown idx tag \"" + x + "\" at " + where); });
        const tm = (c.n || "").match(/\((\d{1,2}):(\d{2})\s*([A-Z]+)\)/);
        if (tm && !TZ.includes(tm[3]))
          errors.push("time annotation uses unsupported zone \"" + tm[3] + "\" at " + where + " (allowed: " + TZ.join(" ") + ")");
      });
    });
  });
  (data.changes || []).forEach((c, i) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(c.d || "")) errors.push("changes[" + i + "]: bad date " + c.d);
    if (!["add","remove","weight"].includes(c.ty)) errors.push("changes[" + i + "]: ty must be add|remove|weight");
    if (!IDX.includes(c.ix)) errors.push("changes[" + i + "]: unknown index tag " + c.ix);
    if (!c.t) errors.push("changes[" + i + "]: missing ticker");
  });
  if ((data.changes || []).length > 20) warn.push("changes[] longer than 20 — trim oldest entries");
}

// ---- dir (search directory) ----
const dir = block("dir");
if (dir) {
  if (!Array.isArray(dir)) errors.push("dir must be an array");
  (dir || []).forEach((c, i) => {
    if (!c.n) errors.push("dir[" + i + "]: missing name");
    if (!Array.isArray(c.l) || !c.l.length) errors.push("dir[" + i + "] (" + c.n + "): listings l[] missing");
    (c.l || []).forEach(L => {
      if (!Array.isArray(L) || L.length !== 3) errors.push("dir " + c.n + ": each listing must be [ticker, market, [idx]]");
      else (L[2] || []).forEach(x => { if (!IDX.includes(x)) errors.push("dir " + c.n + " " + L[0] + ": unknown idx tag " + x); });
    });
  });
}

// ---- inline JS parses ----
const scripts = [...s.matchAll(/<script>([\s\S]*?)<\/script>/g)];
if (!scripts.length) errors.push("no inline <script> found");
else { try { new Function(scripts[scripts.length - 1][1]); } catch (e) { errors.push("app JavaScript has a syntax error: " + e.message); } }

for (const w of warn) console.log("WARN  " + w);
for (const e of errors) console.log("ERROR " + e);
if (errors.length) { console.log("\n" + errors.length + " error(s) — fix before pushing."); process.exit(1); }
console.log("\nALL CHECKS PASSED (" + (data && data.weeks ? data.weeks.length : 0) + " weeks, " + (dir ? dir.length : 0) + " directory companies" + (warn.length ? ", " + warn.length + " warning(s)" : "") + ")");
