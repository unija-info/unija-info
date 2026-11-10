// Session helpers — stateless HMAC-signed cookies, no database.
// Requires Node 18+ (global fetch not needed here; crypto only).
const crypto = require('crypto');

const COOKIE = 'unija_session';
const STATE_COOKIE = 'unija_oauth_state';
const SESSION_TTL = 7 * 86400; // seconds

function b64urlEncode(input) {
  return Buffer.from(input).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s) {
  s = String(s).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64').toString();
}

function sign(email, secret) {
  const h = b64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64urlEncode(JSON.stringify({ email: email, exp: Math.floor(Date.now() / 1000) + SESSION_TTL }));
  const sig = crypto.createHmac('sha256', secret).update(h + '.' + p).digest();
  return h + '.' + p + '.' + b64urlEncode(sig);
}

function verify(token, secret) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 3 || !secret) return null;
    const expect = crypto.createHmac('sha256', secret).update(parts[0] + '.' + parts[1]).digest();
    const got = Buffer.from(parts[2].replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    if (expect.length !== got.length) return null;
    if (!crypto.timingSafeEqual(expect, got)) return null;
    const payload = JSON.parse(b64urlDecode(parts[1]));
    if (!payload.email || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload.email;
  } catch (e) {
    return null;
  }
}

function parseCookies(req) {
  const out = {};
  const raw = (req.headers && req.headers.cookie) || '';
  raw.split(';').forEach(function (part) {
    const i = part.indexOf('=');
    if (i < 0) return;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function cookieHeader(name, value, opts) {
  opts = opts || {};
  let s = name + '=' + encodeURIComponent(value) + '; Path=/; HttpOnly; SameSite=Lax';
  if (opts.secure !== false) s += '; Secure';
  if (opts.maxAge) s += '; Max-Age=' + opts.maxAge;
  return s;
}

function allowlist() {
  return String(process.env.ADMIN_EMAILS || '').split(',')
    .map(function (s) { return s.trim().toLowerCase(); })
    .filter(Boolean);
}

module.exports = { COOKIE, STATE_COOKIE, SESSION_TTL, sign, verify, parseCookies, cookieHeader, allowlist };
