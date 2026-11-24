// Fynd.club site server: serves the built site (dist/) and emails form submissions over SMTP.
// Run: npm run build && npm start   (settings in .env; see .env.example)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import nodemailer from 'nodemailer';

const env = process.env;
const PORT = Number(env.PORT || 8787);
const DIST = join(import.meta.dirname, 'dist');
const MAIL_TO = env.MAIL_TO || 'nagarajkosigi1210@gmail.com';

for (const key of ['SMTP_USER', 'SMTP_PASS']) {
  if (!env[key]) { console.error(`Missing ${key} in .env (see .env.example)`); process.exit(1); }
}

const mailer = nodemailer.createTransport({
  host: env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(env.SMTP_PORT || 465),
  secure: Number(env.SMTP_PORT || 465) === 465,
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
});
mailer.verify().then(
  () => console.log(`SMTP ready (${env.SMTP_USER}); forms go to ${MAIL_TO}`),
  (err) => console.error(`SMTP login failed: ${err.message}`),
);

// ---- /api/enquiry ----
const SUBJECTS = { sell: 'New SELL request', buy: 'New BUY enquiry' };
const hits = new Map(); // ip -> recent timestamps; max 5 submissions per 10 minutes
function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 10 * 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 5;
}

async function readJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 20_000) throw new Error('too large');
  }
  return JSON.parse(body);
}

async function enquiry(req, res) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
  if (limited(ip)) return json(res, 429, { error: 'Too many requests' });
  let data;
  try { data = await readJson(req); } catch { return json(res, 400, { error: 'Bad request' }); }
  const subject = SUBJECTS[data?.type];
  const fields = data?.fields;
  if (!subject || !fields || typeof fields !== 'object') return json(res, 400, { error: 'Bad request' });
  if (data.website) return json(res, 200, { ok: true, ref: 'FC-OK' }); // honeypot filled in: a bot

  const rows = Object.entries(fields)
    .filter(([k, v]) => typeof k === 'string' && (typeof v === 'string' || typeof v === 'number') && String(v).trim())
    .slice(0, 30)
    .map(([k, v]) => [k.slice(0, 60), String(v).slice(0, 500).replace(/[\r\n]+/g, ' ')]);
  if (!rows.length) return json(res, 400, { error: 'Bad request' });

  const ref = `FC-${Date.now().toString(36).toUpperCase()}`;
  const width = Math.max(...rows.map(([k]) => k.length));
  const text = [`${subject} from the Fynd.club website`, `Reference: ${ref}`, '', ...rows.map(([k, v]) => `${k.padEnd(width)}  ${v}`), '', `Received ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`].join('\n');
  try {
    await mailer.sendMail({ from: `"Fynd.club website" <${env.SMTP_USER}>`, to: MAIL_TO, subject: `${subject} — ${ref}`, text });
  } catch (err) {
    console.error(`Send failed: ${err.message}`);
    return json(res, 502, { error: 'Mail failed' });
  }
  console.log(`Sent ${ref} (${data.type})`);
  json(res, 200, { ok: true, ref });
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

// ---- Static site ----
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.json': 'application/json' };

async function serveFile(req, res) {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  for (const candidate of [path, join(path, 'index.html')]) {
    const file = join(DIST, candidate);
    if (!file.startsWith(DIST)) break;
    const info = await stat(file).catch(() => null);
    if (info?.isFile()) {
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
      return res.end(await readFile(file));
    }
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
}

createServer((req, res) => {
  if (req.url === '/api/enquiry') {
    if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
    return enquiry(req, res).catch(() => json(res, 500, { error: 'Server error' }));
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Method not allowed' });
  serveFile(req, res).catch(() => { res.writeHead(500); res.end(); });
}).listen(PORT, () => console.log(`Fynd.club running at http://localhost:${PORT}`));
