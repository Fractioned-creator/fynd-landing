// ---- Banner slider ----
const slides = [...document.querySelectorAll('.slide')];
const dots = document.querySelector('.dots');
let current = 0;
let timer;

function show(i) {
  slides[current].classList.remove('active');
  dots.children[current].classList.remove('active');
  dots.children[current].setAttribute('aria-selected', 'false');
  current = i;
  slides[current].classList.add('active');
  dots.children[current].classList.add('active');
  dots.children[current].setAttribute('aria-selected', 'true');
}
function restart() {
  clearInterval(timer);
  timer = setInterval(() => show((current + 1) % slides.length), 6000);
}
slides.forEach((_, i) => {
  const b = document.createElement('button');
  b.setAttribute('role', 'tab');
  b.setAttribute('aria-label', `Banner ${i + 1}`);
  b.setAttribute('aria-selected', String(i === 0));
  if (i === 0) b.classList.add('active');
  b.addEventListener('click', () => { show(i); restart(); });
  dots.appendChild(b);
});
const banners = document.querySelector('.banners');
banners.addEventListener('mouseenter', () => clearInterval(timer));
banners.addEventListener('mouseleave', restart);
restart();

// ---- Sell / Buy: open the matching form inside the section ----
const wrap = document.getElementById('form-wrap');
const choices = document.querySelectorAll('.choice-btn');

function openForm(kind, brand) {
  choices.forEach((c) => c.setAttribute('aria-selected', String(c.dataset.form === kind)));
  document.querySelectorAll('.inline-form').forEach((f) => { f.hidden = f.id !== `form-${kind}`; });
  wrap.classList.add('open');
  if (brand) {
    const select = document.querySelector(`#form-${kind} select[name=brand]`);
    if (select) { select.value = brand; select._cs?.sync(); }
  }
}

choices.forEach((c) => c.addEventListener('click', () => openForm(c.dataset.form)));
// Links elsewhere on the page (header, banners, brand tiles, footer) open a form too.
// They point to /buy and /sell (the server serves this page there), so those URLs can be shared.
const section = document.getElementById('action');
const FORM_PATHS = { '/buy': 'buy', '/sell': 'sell' };
function goToForm(kind, brand, smooth = true) {
  openForm(kind, brand);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  section.scrollIntoView({ behavior: smooth && !reduce ? 'smooth' : 'auto' });
}
document.querySelectorAll('[data-open]').forEach((a) =>
  a.addEventListener('click', (e) => {
    e.preventDefault();
    const path = `/${a.dataset.open}`;
    if (location.pathname !== path) history.pushState(null, '', path);
    goToForm(a.dataset.open, a.dataset.brand);
  }),
);
function fromUrl(smooth) {
  const kind = FORM_PATHS[location.pathname.replace(/\/+$/, '')] ?? { '#buy': 'buy', '#sell': 'sell' }[location.hash];
  if (kind) goToForm(kind, undefined, smooth);
}
window.addEventListener('popstate', () => fromUrl(true));
fromUrl(false);

// ---- Sending: POST /api/enquiry; server.js emails it over SMTP ----
const API = window.FYND_API_BASE ?? '';

async function send(type, fields) {
  const clean = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined && v !== ''));
  let res;
  try {
    res = await fetch(`${API}/api/enquiry`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, fields: clean }),
    });
  } catch {
    throw new Error("We couldn't reach our server. Please check your connection and try again.");
  }
  if (res.status === 429) throw new Error('Too many requests from your connection. Please wait a few minutes and try again.');
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error("We couldn't send your request. Please try again or call us on +91 97410 78731.");
  return data.ref;
}

const text = (form, name) => form.elements[name]?.value.trim() || undefined;
/** The text the customer saw for a select or radio choice, e.g. "Under ₹30,000" rather than "UNDER_30K". */
const shown = (form, name) => {
  const el = form.querySelector(`select[name=${name}]:not([disabled]), [name=${name}]:checked`);
  if (!el || !el.value) return undefined;
  return (el.tagName === 'SELECT' ? el.selectedOptions[0]?.text : el.closest('label')?.textContent)?.trim();
};
const checked = (form, name) => form.elements[name]?.checked ?? false;

/**
 * Storage option values: "512" (MacBook, SSD), "SSD:512", "HDD:1024" or "SSD+HDD:256+1024".
 * Returns the total size in GB (the API's storageGb) and, for PC drives, a label with the drive type for the notes.
 */
function parseStorage(v) {
  if (!v) return {};
  const size = (gb) => (gb >= 1024 ? `${gb / 1024} TB` : `${gb} GB`);
  if (!v.includes(':')) return { gb: Number(v) };
  const [kind, sizes] = v.split(':');
  const parts = sizes.split('+').map(Number);
  const label = kind === 'SSD+HDD' ? `${size(parts[0])} SSD + ${size(parts[1])} HDD` : `${size(parts[0])} ${kind}`;
  return { gb: parts.reduce((a, b) => a + b, 0), label };
}

async function submitSell(form) {
  // Spec fields live in two groups (MacBook / other); read only the one on screen. "Not sure" is left out.
  const spec = (name) => {
    const v = form.querySelector(`[data-specs]:not([hidden]) [name=${name}]`)?.value;
    return v && v !== 'NOT_SURE' ? v : undefined;
  };
  const storage = parseStorage(spec('storage'));
  const yes = (name) => (checked(form, name) ? 'Yes' : 'No');
  return send('sell', {
    Name: text(form, 'name'), Phone: `+91 ${text(form, 'phone')}`, City: text(form, 'city'),
    Brand: text(form, 'brand'), Model: text(form, 'model'),
    Processor: spec('chip') ?? spec('processor'),
    RAM: spec('ram') && `${spec('ram')} GB`,
    Storage: storage.label ?? (storage.gb && `${storage.gb} GB SSD`),
    Graphics: spec('gpu'),
    Condition: shown(form, 'condition'),
    'Laptop age': shown(form, 'age'),
    Charger: yes('charger'), Bill: yes('bill'), 'Original box': yes('box'),
  });
}

/** Buy form → email. */
async function submitBuy(form) {
  const ram = text(form, 'ram');
  return send('buy', {
    Name: text(form, 'name'), Phone: `+91 ${text(form, 'phone')}`, City: text(form, 'city'),
    'Use case': shown(form, 'use'), Budget: shown(form, 'budget'),
    'Preferred brand': text(form, 'brand'), 'Minimum RAM': ram && `${ram} GB`,
  });
}

// ---- Sell form: MacBook vs other spec fields, by brand ----
const sellForm = document.getElementById('form-sell');
const MODEL_HINTS = {
  Apple: 'e.g. MacBook Air 13" (2022)', Dell: 'e.g. Latitude 5420, XPS 13', HP: 'e.g. EliteBook 840 G8',
  Lenovo: 'e.g. ThinkPad T14 Gen 2', ASUS: 'e.g. ZenBook 14', Acer: 'e.g. Swift 3', Microsoft: 'e.g. Surface Laptop 5',
};
function showSpecs() {
  const brand = sellForm.elements.brand.value;
  const which = !brand ? null : brand === 'Apple' ? 'mac' : 'pc';
  sellForm.querySelectorAll('[data-specs]').forEach((g) => {
    const on = g.dataset.specs === which;
    g.hidden = !on;
    g.style.display = on ? '' : 'none'; // works even with an old cached stylesheet
    // Hidden selects are disabled so they skip validation.
    g.querySelectorAll('select').forEach((s) => { s.disabled = !on; s.classList.remove('invalid'); s._cs?.sync(); });
  });
  sellForm.elements.model.placeholder = MODEL_HINTS[brand] ?? (brand ? 'Model name' : 'Choose a brand first');
}
sellForm.elements.brand.addEventListener('change', showSpecs);
showSpecs();

// ---- Validation + submit ----
document.querySelectorAll('.inline-form').forEach((form) => {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let firstBad = null;
    form.querySelectorAll('.invalid').forEach((el) => el.classList.remove('invalid'));

    form.querySelectorAll('input:not([type=radio]):not([type=checkbox]), select').forEach((el) => {
      if (!el.checkValidity()) { el.classList.add('invalid'); firstBad ??= el; }
    });
    form.querySelectorAll('fieldset').forEach((fs) => {
      const radios = fs.querySelectorAll('input[type=radio][required]');
      if (radios.length && !fs.querySelector('input[type=radio]:checked')) {
        fs.classList.add('invalid'); firstBad ??= radios[0];
      }
    });
    if (firstBad) { (firstBad._cs?.trigger ?? firstBad).focus(); return; }

    const submitBtn = form.querySelector('[type=submit]');
    const errorBox = form.querySelector('.form-error');
    const label = submitBtn.innerHTML; // keeps the arrow icon
    errorBox.hidden = true;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';
    try {
      const ref = await (form.id === 'form-sell' ? submitSell(form) : submitBuy(form));
      const success = form.querySelector('.success');
      success.querySelector('.ref').textContent = ref ? ` (ref. ${ref})` : '';
      success.hidden = false;
      submitBtn.textContent = 'Sent';
      success.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.hidden = false;
      submitBtn.disabled = false;
      submitBtn.innerHTML = label;
    }
  });
  form.addEventListener('input', (e) => {
    e.target.classList.remove('invalid');
    e.target.closest('fieldset')?.classList.remove('invalid');
  });
});

document.getElementById('year').textContent = new Date().getFullYear();
