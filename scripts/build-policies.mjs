// Generates /<slug>/index.html for each store policy from content/*.ts (same Markdown subset as the storefront's PolicyDocument).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGES = [
  ['privacy-policy', 'Privacy Policy'],
  ['terms-of-service', 'Terms of Service'],
  ['warranty-policy', 'Laptop Warranty & Service Policy'],
  ['return-policy', 'Cancellation & Return Policy'],
  ['shipping-policy', 'Shipping & Delivery Policy'],
  ['quality-check-policy', 'Quality Check & Refurbishment Policy'],
];
const FOOTER_LINKS = [['privacy-policy', 'Privacy'], ['terms-of-service', 'Terms'], ['warranty-policy', 'Warranty'], ['return-policy', 'Returns'], ['shipping-policy', 'Shipping'], ['quality-check-policy', 'Quality Check']];
const GRIEVANCE = { name: 'Abhishek Bothra', designation: 'Grievance Officer', phone: '+91 97410 78731', email: 'support@fynd.club' };

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inline = (t) => t.split(/(\*\*[^*]+\*\*)/).map((p) => (p.startsWith('**') && p.endsWith('**') ? `<strong>${esc(p.slice(2, -2))}</strong>` : esc(p))).join('');

function readSource(slug) {
  const ts = readFileSync(join(root, 'content', `${slug}.ts`), 'utf8');
  const m = ts.match(/`([\s\S]*)`/);
  if (!m) throw new Error(`No policy text found in content/${slug}.ts`);
  return m[1];
}

function render(source) {
  const lines = source.trim().split('\n');
  const at = (n) => lines[n] ?? '';
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = at(i);
    if (!line.trim()) { i++; continue; }
    if (line.startsWith('# ')) { out.push(`<h1>${inline(line.slice(2))}</h1>`); i++; }
    else if (line.startsWith('## ')) { out.push(`<h2>${inline(line.slice(3))}</h2>`); i++; }
    else if (line.startsWith('### ')) { out.push(`<h3>${inline(line.slice(4))}</h3>`); i++; }
    else if (line.startsWith('|')) {
      const rows = [];
      while (i < lines.length && at(i).startsWith('|')) {
        const cells = at(i++).trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        if (!cells.every((c) => /^:?-+:?$/.test(c))) rows.push(cells);
      }
      const [head = [], ...body] = rows;
      out.push(`<div class="policy-table"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
    } else if (/^(- |\d+\. )/.test(line)) {
      const tag = /^\d+\. /.test(line) ? 'ol' : 'ul';
      const items = [];
      while (i < lines.length && /^(- |\d+\. )/.test(at(i))) items.push(at(i++).replace(/^(- |\d+\. )/, ''));
      out.push(`<${tag}>${items.map((t) => `<li>${inline(t)}</li>`).join('')}</${tag}>`);
    } else {
      const para = [];
      while (i < lines.length && at(i).trim() && !/^(#{1,3} |\||- |\d+\. )/.test(at(i))) para.push(at(i++).trimEnd());
      out.push(`<p>${para.map(inline).join('<br />')}</p>`);
    }
  }
  return out.join('\n');
}

const page = (slug, title, body) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)} — Fynd.club</title>
  <link rel="icon" href="/logomark.svg" />
  <link rel="stylesheet" href="/styles.css" />
  <link rel="stylesheet" href="/policy.css" />
</head>
<body>
  <header class="header">
    <div class="container header-inner">
      <a href="/" class="logo"><img src="/logo.svg" alt="Fynd.club" /></a>
      <nav class="nav" aria-label="Main">
        <a href="/buy">Buy a laptop</a>
        <a href="/sell">Sell your laptop</a>
        <a href="/#brands">Brands</a>
        <a href="/#faq">FAQ</a>
      </nav>
      <a href="tel:+919741078731" class="btn btn-dark btn-sm">Call +91 97410 78731</a>
    </div>
  </header>

  <main class="container policy">
    <article>
${body}
    </article>
    <section class="grievance" aria-labelledby="grievance-officer">
      <h2 id="grievance-officer">Grievance Officer</h2>
      <p><strong>${esc(GRIEVANCE.name)}</strong>, ${esc(GRIEVANCE.designation)}<br />
      Phone: <a href="tel:${GRIEVANCE.phone.replace(/\s/g, '')}">${esc(GRIEVANCE.phone)}</a><br />
      Email: <a href="mailto:${GRIEVANCE.email}">${esc(GRIEVANCE.email)}</a></p>
      <p class="grievance-note">Complaints are acknowledged within 48 hours and resolved within one month.</p>
    </section>
  </main>

  <footer class="footer">
    <div class="container footer-bottom">
      <small>© <span id="year"></span> Fynd.club. All rights reserved.</small>
      <nav aria-label="Policies">
${FOOTER_LINKS.map(([s, l]) => `        <a href="/${s}"${s === slug ? ' aria-current="page"' : ''}>${l}</a>`).join('\n')}
      </nav>
    </div>
  </footer>
  <script>document.getElementById('year').textContent = new Date().getFullYear();</script>
  <script src="/back-to-top.js"></script>
</body>
</html>
`;

for (const [slug, title] of PAGES) {
  const file = join(root, slug, 'index.html');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, page(slug, title, render(readSource(slug))));
  console.log(`wrote ${slug}/index.html`);
}
