// POST /api/publish-calendar — validate events, regen weeks, commit to GitHub.
// Auth: signed session cookie + ADMIN_EMAILS allowlist.
// Env: SESSION_SECRET, ADMIN_EMAILS, GITHUB_TOKEN.
const session = require('./lib/session');
const weeksLib = require('./lib/weeks');

const REPO = 'unija-info/unija-info';
const BRANCH = 'main';
const FILE_PATH = 'online/data/calendar.json';

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

async function github(path, token, opts) {
  opts = opts || {};
  const r = await fetch('https://api.github.com' + path, {
    method: opts.method || 'GET',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + token,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await r.json().catch(function () { return {}; });
  return { ok: r.ok, status: r.status, data: data };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST sahaja' });
  if (!process.env.GITHUB_TOKEN) return json(res, 500, { error: 'GITHUB_TOKEN tiada' });

  const cookies = session.parseCookies(req);
  const email = session.verify(cookies[session.COOKIE], process.env.SESSION_SECRET);
  if (!email || session.allowlist().indexOf(email) < 0) {
    return json(res, 401, { error: 'belum log masuk / tiada akses' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { return json(res, 400, { error: 'JSON tidak sah' }); }
  }
  const events = body && body.events;
  if (!Array.isArray(events) || !events.length) {
    return json(res, 400, { error: 'events[] wajib dan tidak boleh kosong' });
  }

  const seen = {};
  const errs = [];
  events.forEach(function (ev) {
    weeksLib.validateEvent(ev, seen).forEach(function (e) { errs.push(e); });
  });
  if (errs.length) return json(res, 400, { error: 'validasi gagal', detail: errs });

  // Preserve week numbering prefs of existing events; regen the spans.
  const token = process.env.GITHUB_TOKEN;
  const cur = await github('/repos/' + REPO + '/contents/' + FILE_PATH + '?ref=' + BRANCH, token);
  if (!cur.ok) return json(res, 502, { error: 'gagal baca fail semasa di GitHub', detail: cur.status });
  let prev = {};
  try {
    const current = JSON.parse(Buffer.from(cur.data.content, 'base64').toString('utf8'));
    (current.events || []).forEach(function (ev) {
      if (ev.type === 'kuliah') prev[ev.id] = { week_start: ev.week_start, week_offset_days: ev.week_offset_days };
    });
  } catch (e) { return json(res, 502, { error: 'fail semasa rosak di GitHub' }); }

  // Deep-copy so regen never mutates the caller's objects unexpectedly.
  const fresh = JSON.parse(JSON.stringify(events));
  weeksLib.regenWeeks(fresh, prev);

  const payload = {
    sesi: (body && body.sesi) || '2026/2027',
    program: 'Diploma dan Sarjana Muda',
    sumber_pdf: 'file/PINDAAN RUMUSAN KALENDAR 2026_2027.pdf',
    kelulusan: 'Mesyuarat Senat Kali Ke 236 Bil.6/2026',
    nota_umum_ms: 'Tertakluk kepada perubahan.',
    nota_umum_en: '',
    events: fresh,
  };
  const content = Buffer.from(JSON.stringify(payload, null, 2) + '\n').toString('base64');
  const put = await github('/repos/' + REPO + '/contents/' + FILE_PATH, token, {
    method: 'PUT',
    body: {
      message: '[Admin] Kemas kini kalendar (' + email + ')',
      content: content,
      sha: cur.data.sha,
      branch: BRANCH,
    },
  });
  if (!put.ok) {
    return json(res, 502, { error: 'gagal tulis ke GitHub', detail: (put.data && put.data.message) || put.status });
  }
  return json(res, 200, { ok: true, commit: (put.data.commit && put.data.commit.sha) || null });
};
