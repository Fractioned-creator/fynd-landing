// "Back to top" arrow: appears after scrolling down, smooth-scrolls to the top.
(() => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'to-top';
  btn.setAttribute('aria-label', 'Back to top');
  btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>';
  document.body.appendChild(btn);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduce.matches ? 'auto' : 'smooth' }));
  const update = () => btn.classList.toggle('is-visible', window.scrollY > 400);
  window.addEventListener('scroll', update, { passive: true });
  update();
})();
