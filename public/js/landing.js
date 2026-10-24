(function () {
  'use strict';
  let values = {};
  let catalog = [];
  let billing = 'yearly';
  let industry = 'grocery';
  const scrollTop = document.getElementById('landingScrollTop');
  const updateScrollTop = () => { scrollTop.hidden = window.scrollY < 320; };
  window.addEventListener('scroll', updateScrollTop, { passive: true });
  updateScrollTop();
  scrollTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  function apply() {
    for (const [attribute, property] of [['text', 'textContent'], ['link', 'href'], ['placeholder', 'placeholder']]) {
      document.querySelectorAll(`[data-landing-${attribute}]`).forEach(element => {
        const key = element.getAttribute(`data-landing-${attribute}`);
        if (Object.hasOwn(values, key)) element[property] = values[key];
      });
    }
    for (const plan of ['basic', 'pro', 'chain']) {
      const value = values[`price.${billing}.${plan}`];
      if (value !== undefined) document.getElementById('price-val-' + plan).textContent = value;
    }
  }
  const originalBilling = window.togglePosBilling;
  window.togglePosBilling = mode => { billing = mode; originalBilling(mode); apply(); };
  const originalIndustry = window.switchIndustry;
  window.switchIndustry = key => { industry = key; originalIndustry(key); apply(); };
  Promise.all([
    fetch('/data/landing-fields.json').then(response => { if (!response.ok) throw new Error(); return response.json(); }),
    fetch('/api/landing', { cache: 'no-store' }).then(response => { if (!response.ok) throw new Error(); return response.json(); })
  ]).then(([fields, content]) => {
    catalog = fields;
    values = Object.fromEntries(catalog.map(field => [field.key, content.overrides?.[field.key] ?? field.value]));
    for (const field of catalog) {
      if (!field.key.startsWith('industry.')) continue;
      const [, key, property, index] = field.key.split('.');
      const value = escape(values[field.key]);
      if (index === undefined) industryData[key][property] = value;
      else industryData[key][property][Number(index)] = value;
    }
    window.switchIndustry(industry);
    apply();
  }).catch(() => {
    // Keep the original page available during a content/database outage.
  });

  window.submitOneSoftForm = async event => {
    event.preventDefault();
    const form = document.getElementById('onesoft-form');
    const status = document.getElementById('os-form-success');
    const button = form.querySelector('button[type="submit"]');
    const body = Object.fromEntries(['name', 'phone', 'store', 'industry', 'package', 'note'].map(key => [key, document.getElementById('os-' + key).value.trim()]));
    const checks = { name: body.name.length >= 2, phone: /^[0-9+\s()-]{9,20}$/.test(body.phone), store: body.store.length >= 2 };
    for (const [key, valid] of Object.entries(checks)) document.getElementById('err-os-' + key).classList.toggle('hidden', valid);
    if (Object.values(checks).includes(false)) return;
    button.disabled = true;
    status.classList.add('hidden');
    try {
      const response = await fetch('/api/landing/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Chưa gửi được yêu cầu');
      status.textContent = 'Đã gửi yêu cầu. OneSoft sẽ liên hệ tư vấn cho bạn.';
      form.reset();
    } catch (error) {
      status.textContent = error.message || 'Không kết nối được máy chủ. Vui lòng thử lại.';
    } finally {
      status.classList.remove('hidden');
      status.setAttribute('role', 'status');
      button.disabled = false;
    }
  };
})();
