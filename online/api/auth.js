// GET /api/auth?action=login|callback|logout|me — Google OAuth, allowlist gate.
// Env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET, ADMIN_EMAILS.
const crypto = require('crypto');
const session = require('./lib/session');

function baseUrl(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return proto + '://' + host;
}

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(body);
}

module.exports = async function handler(req, res) {
  const action = (req.query && req.query.action) || '';
  const cookies = session.parseCookies(req);

  if (action === 'login') {
    if (!process.env.GOOGLE_CLIENT_ID) return json(res, 500, { error: 'GOOGLE_CLIENT_ID tiada' });
    const state = crypto.randomBytes(16).toString('hex');
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: baseUrl(req) + '/api/auth?action=callback',
      response_type: 'code',
      scope: 'openid email profile',
      state: state,
    });
    res.writeHead(302, {
      'Set-Cookie': session.cookieHeader(session.STATE_COOKIE, state, { maxAge: 600 }),
      Location: 'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString(),
    });
    return res.end();
  }

  if (action === 'callback') {
    try {
      const state = req.query.state || '';
      if (!state || !cookies[session.STATE_COOKIE] || state !== cookies[session.STATE_COOKIE]) {
        return json(res, 400, { error: 'state tidak sah — sila cuba log masuk semula' });
      }
      if (!req.query.code) return json(res, 400, { error: 'tiada kod OAuth' });
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: req.query.code,
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri: baseUrl(req) + '/api/auth?action=callback',
          grant_type: 'authorization_code',
        }).toString(),
      });
      const tokens = await tokenRes.json();
      if (!tokenRes.ok || !tokens.id_token) {
        return json(res, 401, { error: 'pertukaran token gagal', detail: tokens.error || '' });
      }
      const infoRes = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(tokens.id_token));
      const info = await infoRes.json();
      if (!infoRes.ok || info.aud !== process.env.GOOGLE_CLIENT_ID) {
        return json(res, 401, { error: 'token Google tidak sah' });
      }
      const email = String(info.email || '').toLowerCase();
      if (info.email_verified !== 'true' && info.email_verified !== true) {
        return json(res, 403, { error: 'emel Google belum disahkan' });
      }
      if (session.allowlist().indexOf(email) < 0) {
        return json(res, 403, { error: 'akaun ini tiada dalam senarai admin' });
      }
      const jwt = session.sign(email, process.env.SESSION_SECRET);
      res.writeHead(302, {
        'Set-Cookie': [
          session.cookieHeader(session.COOKIE, jwt, { maxAge: session.SESSION_TTL }),
          session.cookieHeader(session.STATE_COOKIE, '', { maxAge: 1 }),
        ],
        Location: '/admin/',
      });
      return res.end();
    } catch (e) {
      return json(res, 500, { error: 'ralat pelayan', detail: String((e && e.message) || e) });
    }
  }

  if (action === 'logout') {
    res.writeHead(302, {
      'Set-Cookie': session.cookieHeader(session.COOKIE, '', { maxAge: 1 }),
      Location: '/',
    });
    return res.end();
  }

  if (action === 'me') {
    const email = session.verify(cookies[session.COOKIE], process.env.SESSION_SECRET);
    if (!email) return json(res, 401, { error: 'belum log masuk' });
    return json(res, 200, { email: email });
  }

  return json(res, 400, { error: 'action tidak sah' });
};
