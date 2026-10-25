// Move device data before the POS or display settings read their new keys.
(function () {
  const legacyPrefix = 'thichgapos_';
  const currentPrefix = 'onesoftpos_';
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(legacyPrefix)) keys.push(key);
    }
    for (const key of keys) {
      const target = currentPrefix + key.slice(legacyPrefix.length);
      if (localStorage.getItem(target) === null) localStorage.setItem(target, localStorage.getItem(key));
      localStorage.removeItem(key);
    }
  } catch (_) { /* Keep existing storage intact when the browser disallows writes. */ }
})();
