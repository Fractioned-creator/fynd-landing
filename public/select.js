// Custom dropdowns for the form <select>s: a styled, scrollable list instead of the browser's native menu.
// The real <select> stays in the page (visually hidden) and remains the source of truth, so validation,
// FormData and existing change listeners keep working. Call select._cs.sync() after setting .value in code.
(function () {
  let open = null; // the currently open dropdown

  function enhance(select) {
    const control = select.closest('.control');
    control.classList.add('cs');

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'cs-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    const labelText = select.closest('label')?.firstChild?.textContent.trim();
    if (labelText) trigger.setAttribute('aria-label', labelText);

    const list = document.createElement('div');
    list.className = 'cs-list';
    list.setAttribute('role', 'listbox');
    list.tabIndex = -1;
    list.hidden = true;

    select.after(trigger, list);
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');

    const items = () => [...list.querySelectorAll('.cs-option')];
    let active = -1;

    function build() {
      list.innerHTML = '';
      for (const node of select.children) {
        if (node.tagName === 'OPTGROUP') {
          const h = document.createElement('div');
          h.className = 'cs-group';
          h.textContent = node.label;
          list.append(h);
          for (const o of node.children) list.append(option(o));
        } else if (node.value !== '') {
          list.append(option(node)); // the empty "Select …" option is the placeholder, not a choice
        }
      }
    }
    function option(o) {
      const el = document.createElement('div');
      el.className = 'cs-option';
      el.setAttribute('role', 'option');
      el.dataset.value = o.value;
      el.textContent = o.textContent;
      if (o.value === 'NOT_SURE') el.classList.add('cs-muted');
      el.addEventListener('mousedown', (e) => e.preventDefault()); // keep focus on the trigger
      el.addEventListener('click', () => choose(o.value));
      return el;
    }

    function sync() {
      const o = select.selectedOptions[0];
      const empty = !o || o.value === '';
      trigger.textContent = o ? o.textContent : '';
      trigger.classList.toggle('cs-placeholder', empty);
      trigger.disabled = select.disabled;
      for (const el of items()) el.setAttribute('aria-selected', String(el.dataset.value === select.value && !empty));
    }

    function choose(value) {
      if (select.value !== value) {
        select.value = value;
        select.dispatchEvent(new Event('input', { bubbles: true }));
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      sync();
      close();
      trigger.focus();
    }

    function highlight(i, scroll = true) {
      const all = items();
      if (!all.length) return;
      active = Math.max(0, Math.min(all.length - 1, i));
      all.forEach((el, k) => el.classList.toggle('cs-active', k === active));
      if (scroll) all[active].scrollIntoView({ block: 'nearest' });
    }

    function show() {
      if (open && open !== api) open.close();
      list.hidden = false;
      control.classList.add('cs-open');
      trigger.setAttribute('aria-expanded', 'true');
      open = api;
      // Open upwards if there isn't room below.
      const r = trigger.getBoundingClientRect();
      control.classList.toggle('cs-up', window.innerHeight - r.bottom < 300 && r.top > window.innerHeight - r.bottom);
      const sel = items().findIndex((el) => el.dataset.value === select.value);
      highlight(sel >= 0 ? sel : 0, false);
      const target = items()[active];
      if (target) list.scrollTop = target.offsetTop - list.clientHeight / 2 + target.offsetHeight / 2;
    }
    function close() {
      list.hidden = true;
      control.classList.remove('cs-open', 'cs-up');
      trigger.setAttribute('aria-expanded', 'false');
      if (open === api) open = null;
    }

    let typed = '', typedAt = 0;
    trigger.addEventListener('click', () => (list.hidden ? show() : close()));
    trigger.addEventListener('keydown', (e) => {
      const isOpen = !list.hidden;
      const searching = typed && Date.now() - typedAt < 700; // a space mid-search is part of the search, not "select"
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!isOpen) return show();
        highlight(active + (e.key === 'ArrowDown' ? 1 : -1));
      } else if (e.key === 'Home' && isOpen) { e.preventDefault(); highlight(0); }
      else if (e.key === 'End' && isOpen) { e.preventDefault(); highlight(items().length - 1); }
      else if (e.key === 'Enter' || (e.key === ' ' && !searching)) {
        e.preventDefault();
        if (!isOpen) return show();
        const el = items()[active];
        if (el) choose(el.dataset.value);
      } else if (e.key === 'Escape' && isOpen) { e.preventDefault(); close(); }
      else if (e.key === 'Tab') close();
      else if (e.key.length === 1 && (/\S/.test(e.key) || searching)) {
        e.preventDefault();
        // Type-ahead: jump to the first option starting with what was typed.
        const now = Date.now();
        typed = (now - typedAt > 700 ? '' : typed) + e.key.toLowerCase();
        typedAt = now;
        if (!isOpen) show();
        const i = items().findIndex((el) => el.textContent.toLowerCase().startsWith(typed));
        if (i >= 0) highlight(i);
      }
    });
    list.addEventListener('mousemove', (e) => {
      const i = items().indexOf(e.target.closest('.cs-option'));
      if (i >= 0 && i !== active) highlight(i, false);
    });
    select.addEventListener('change', sync);
    select.form?.addEventListener('reset', () => setTimeout(sync));

    const api = { sync, close, trigger };
    select._cs = api;
    build();
    sync();
  }

  document.addEventListener('mousedown', (e) => {
    if (open && !e.target.closest('.cs.cs-open')) open.close();
  });
  window.addEventListener('resize', () => open && open.close());

  document.querySelectorAll('.inline-form .control select').forEach(enhance);
})();
