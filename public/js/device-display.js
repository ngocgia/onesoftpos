/** Device-local layout preferences: shared by staff on this POS, never synced. */
(function () {
  'use strict';
  const key = 'onesoftpos_device_display_v1';
  const edges = ['top', 'bottom', 'left', 'right'];
  const defaults = { auto: true, top: 0, bottom: 0, left: 0, right: 0 };
  function normalize(value) {
    const data = value && typeof value === 'object' ? value : {};
    const result = { auto: data.auto !== false };
    edges.forEach(edge => {
      const number = Number(data[edge]);
      result[edge] = Number.isFinite(number) ? Math.max(0, Math.min(160, Math.round(number))) : 0;
    });
    return result;
  }
  let settings = { ...defaults };
  try { settings = normalize(JSON.parse(localStorage.getItem(key))); } catch (_) { /* Defaults if storage is unavailable. */ }
  function apply(value) {
    edges.forEach(edge => {
      document.documentElement.style.setProperty('--pos-system-' + edge, value.auto
        ? `max(env(safe-area-inset-${edge}, 0px), var(--android-inset-${edge}, 0px))` : '0px');
      document.documentElement.style.setProperty('--pos-extra-' + edge, value[edge] + 'px');
    });
  }
  apply(settings);
  document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('deviceDisplayModal');
    const form = document.getElementById('deviceDisplayForm');
    function populate(value) {
      form.elements.auto.checked = value.auto;
      edges.forEach(edge => { form.elements[edge].value = value[edge]; });
    }
    document.getElementById('menuItemDeviceDisplay').addEventListener('click', () => {
      populate(settings);
      document.getElementById('deviceDisplayStatus').textContent = '';
      modal.style.display = 'flex';
    });
    modal.querySelectorAll('[data-close-display]').forEach(button => {
      button.addEventListener('click', () => { modal.style.display = 'none'; });
    });
    document.getElementById('deviceDisplayPreset').addEventListener('click', () => {
      populate({ ...defaults, top: 32, bottom: 64 });
    });
    document.getElementById('deviceDisplayReset').addEventListener('click', () => { populate(defaults); });
    form.addEventListener('submit', event => {
      event.preventDefault();
      const value = { auto: form.elements.auto.checked };
      edges.forEach(edge => { value[edge] = form.elements[edge].value; });
      const next = normalize(value);
      try { localStorage.setItem(key, JSON.stringify(next)); }
      catch (_) {
        document.getElementById('deviceDisplayStatus').textContent = 'Không lưu được trên máy. Vui lòng kiểm tra quyền lưu trữ rồi thử lại.';
        return;
      }
      settings = next;
      apply(settings);
      modal.style.display = 'none';
    });
  });
})();
