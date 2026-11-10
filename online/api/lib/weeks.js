// Pure week-registry logic shared by the publish API (and its tests).
// Academic weeks run Sunday–Thursday (Terengganu weekend Fri–Sat excluded),
// numbered continuously per semester (Sesi 2 blocks start at 8),
// capped at week_start+6 (14-week semester rule).
const SEMESTERS = ['pendek', 'pertama', 'kedua'];
const TYPES = ['pendaftaran', 'kuliah', 'cuti-pertengahan', 'ulangkaji', 'peperiksaan', 'cuti-semester'];

function isDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
  return d.getFullYear() === Number(s.slice(0, 4)) &&
    d.getMonth() === Number(s.slice(5, 7)) - 1 &&
    d.getDate() === Number(s.slice(8, 10));
}

function parseD(s) {
  return new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
}

function iso(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + day;
}

function addDays(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

// Validate one event. Returns an array of error strings (empty = valid).
function validateEvent(ev, seenIds) {
  const errs = [];
  const id = ev && ev.id;
  if (!id || typeof id !== 'string') errs.push('id tiada/tidak sah');
  else if (seenIds[id]) errs.push('id duplikat: ' + id);
  else seenIds[id] = true;
  if (SEMESTERS.indexOf(ev.semester) < 0) errs.push(id + ': semester tidak sah');
  if (TYPES.indexOf(ev.type) < 0) errs.push(id + ': type tidak sah');
  if (!ev.title_ms || !String(ev.title_ms).trim()) errs.push(id + ': title_ms wajib');
  if (!isDate(ev.start)) errs.push(id + ': start tidak sah (YYYY-MM-DD)');
  if (ev.end !== null && ev.end !== undefined && !isDate(ev.end)) errs.push(id + ': end tidak sah');
  if (isDate(ev.start) && isDate(ev.end) && ev.start > ev.end) errs.push(id + ': start selepas end');
  ['title_en', 'tempoh_ms', 'nota_ms', 'nota_en'].forEach(function (k) {
    if (ev[k] !== undefined && ev[k] !== null && typeof ev[k] !== 'string') errs.push(id + ': ' + k + ' mesti teks');
  });
  if (ev.program !== undefined && ev.program !== null && typeof ev.program !== 'string') errs.push(id + ': program mesti teks/null');
  return errs;
}

// Regenerate the weeks registry for kuliah events.
// weekStarts: map id -> { week_start, week_offset_days } preserved from the
// current file; new kuliah events default (first in semester -> 1, else 8).
function regenWeeks(events, prev) {
  prev = prev || {};
  const bySem = {};
  events.forEach(function (ev) {
    if (ev.type !== 'kuliah' || !isDate(ev.start) || !(ev.end === null || ev.end === undefined || isDate(ev.end))) return;
    (bySem[ev.semester] = bySem[ev.semester] || []).push(ev);
  });
  Object.keys(bySem).forEach(function (sem) {
    bySem[sem].sort(function (a, b) { return a.start < b.start ? -1 : 1; });
    bySem[sem].forEach(function (ev, i) {
      const kept = prev[ev.id] || {};
      const base = kept.week_start !== undefined ? kept.week_start : (i === 0 ? 1 : 8);
      const off = kept.week_offset_days !== undefined ? kept.week_offset_days : 0;
      ev.week_start = base;
      ev.week_offset_days = off;
      if (!ev.end) { ev.weeks = []; return; }
      const start = addDays(parseD(ev.start), off);
      const end = parseD(ev.end);
      const weeks = [];
      let n = base;
      let cur = start;
      while (cur <= end) {
        let wend = addDays(cur, 4); // Sun–Thu
        if (wend > end) wend = end;
        weeks.push({ n: Math.min(n, base + 6), start: iso(cur), end: iso(wend) });
        n++;
        cur = addDays(wend, 1);
        while (cur <= end && (cur.getDay() === 5 || cur.getDay() === 6)) cur = addDays(cur, 1);
      }
      // merge consecutive same-numbered entries
      const merged = [];
      weeks.forEach(function (w) {
        const p = merged[merged.length - 1];
        if (p && p.n === w.n && w.start === iso(addDays(parseD(p.end), 1))) p.end = w.end;
        else merged.push(w);
      });
      ev.weeks = merged;
    });
  });
  return events;
}

module.exports = { SEMESTERS, TYPES, isDate, parseD, iso, validateEvent, regenWeeks };
