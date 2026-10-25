// Shared speaker settings and native Android/browser audio routing.
window.audioModule = {
  context: null,
  snapshots: new Map(),
  activeStore: null,
  knownItems: new Map(),

  track(kind, id) {
    const store = window.api.getCurrentStoreId();
    if (this.activeStore !== store) { this.snapshots.clear(); this.knownItems.clear(); this.activeStore = store; }
    if (!this.knownItems.has(kind)) this.knownItems.set(kind, new Set());
    const seen = this.knownItems.get(kind);
    const key = String(id);
    const fresh = !seen.has(key);
    seen.add(key);
    if (seen.size > 10000) seen.delete(seen.values().next().value);
    return fresh;
  },

  settings() {
    const defaults = { enableNewOrderSound: true, enableKitchenDoneSound: true, enableVietQRSpeech: true, volume: 85 };
    return window.menuPersistence?.read('speaker', defaults) || defaults;
  },

  volume(value) {
    const numeric = Number(value ?? this.settings().volume);
    return Number.isFinite(numeric) ? Math.max(0, Math.min(100, numeric)) : 85;
  },

  async beep({ volume, force = false } = {}) {
    if (!force && !this.settings().enableNewOrderSound) return;
    const level = this.volume(volume);
    if (!level) return;
    try {
      if (window.onesoftAudio?.beep) { window.onesoftAudio.beep(level); return; }
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) throw new Error('Thiết bị không hỗ trợ phát chuông');
      if (!this.context) this.context = new AudioContext();
      if (this.context.state === 'suspended') await this.context.resume();
      const start = this.context.currentTime;
      for (const [frequency, delay, duration] of [[587.33, 0, 0.2], [880, 0.15, 0.3]]) {
        const oscillator = this.context.createOscillator();
        const gain = this.context.createGain();
        oscillator.frequency.setValueAtTime(frequency, start + delay);
        gain.gain.setValueAtTime(0.3 * level / 100, start + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, start + delay + duration);
        oscillator.connect(gain); gain.connect(this.context.destination);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
        oscillator.start(start + delay); oscillator.stop(start + delay + duration);
      }
    } catch (error) { window.api.showToast('Không thể phát chuông: ' + error.message, 'error'); }
  },

  speak(message, { volume, kind = 'kitchen', force = false } = {}) {
    const enabled = kind === 'qr' ? this.settings().enableVietQRSpeech : this.settings().enableKitchenDoneSound;
    if (!message || (!force && !enabled)) return;
    const level = this.volume(volume);
    if (!level) return;
    try {
      if (window.onesoftAudio?.speak) { window.onesoftAudio.speak(String(message), level); return; }
      if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) throw new Error('Thiết bị không hỗ trợ giọng đọc; hãy dùng APK Android mới');
      const utterance = new window.SpeechSynthesisUtterance(String(message));
      utterance.lang = 'vi-VN'; utterance.rate = 0.95; utterance.volume = level / 100;
      const voice = window.speechSynthesis.getVoices().find(item => String(item.lang).toLowerCase().startsWith('vi'));
      if (voice) utterance.voice = voice;
      utterance.onerror = event => {
        if (!['canceled', 'interrupted'].includes(event.error)) window.api.showToast('Không đọc được thông báo: ' + event.error, 'error');
      };
      window.speechSynthesis.speak(utterance);
    } catch (error) { window.api.showToast(error.message, 'error'); }
  },

  observeItems(kind, orders, scope = 'ALL') {
    const store = window.api.getCurrentStoreId();
    if (!store) return;
    if (this.activeStore !== store) { this.snapshots.clear(); this.knownItems.clear(); this.activeStore = store; }
    const key = `${store}:${kind}:${scope}`;
    const items = orders.flatMap(order => (order.items || []).map(item => ({ order, item })));
    const current = new Set(items.map(({ item }) => String(item.id)));
    const previous = this.snapshots.get(key);
    // Replace snapshot so paid/cancelled items don't accumulate forever. First load is silent.
    this.snapshots.set(key, current);
    const added = items.filter(({ item }) => this.track(kind, item.id) && previous && !previous.has(String(item.id)));
    if (!added.length) return;
    if (kind === 'new') this.beep();
    else this.speak(added.map(({ order, item }) => `Món ${item.product_name}, ${order.order_type === 'DINE_IN' ? 'bàn ' + (order.table_code || order.table_name || '') : 'đơn ' + order.order_code} đã xong`).join('. '));
  }
};
