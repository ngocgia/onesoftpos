(function () {
  window.onesoftBuildReceiptSnapshot = function () {
    var invoice = window.invoiceModule || {};
    var saved = window.menuPersistence && typeof window.menuPersistence.read === 'function' ? window.menuPersistence.read('printer', {}) : {};
    var data = {
      text: invoice.receiptText || '', qrUrl: invoice.receiptQrUrl || '', footer: invoice.receiptFooterText || '',
      ip: window.appState && window.appState.storeSettings && window.appState.storeSettings.receipt_ip_address || saved.ipAddress || '',
      storeId: String(window.api && window.api.getCurrentStoreId ? window.api.getCurrentStoreId() : '')
    };
    var paper = document.getElementById('receiptPaper');
    if (!paper || !paper.getBoundingClientRect().width) throw new Error('Chưa hiển thị nội dung hóa đơn');
    var copy = paper.cloneNode(true);
    var originals = [paper].concat(Array.from(paper.querySelectorAll('*')));
    var copies = [copy].concat(Array.from(copy.querySelectorAll('*')));
    // Copy only receipt layout styles; no POS modal, theme, navigation or external stylesheet.
    var properties = ['display', 'box-sizing', 'width', 'min-width', 'max-width', 'height', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-align', 'text-transform', 'text-decoration', 'white-space', 'word-break', 'overflow-wrap', 'vertical-align', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'border-top', 'border-right', 'border-bottom', 'border-left', 'border-collapse', 'border-spacing', 'table-layout', 'flex-direction', 'flex-wrap', 'flex-shrink', 'flex-grow', 'justify-content', 'align-items', 'gap', 'image-rendering'];
    originals.forEach(function (element, index) {
      var clone = copies[index], style = getComputedStyle(element);
      clone.removeAttribute('style');
      Array.from(clone.attributes).forEach(function (attribute) {
        if (/^on/i.test(attribute.name) || ['srcset', 'href'].includes(attribute.name)) clone.removeAttribute(attribute.name);
      });
      properties.forEach(function (property) { clone.style.setProperty(property, style.getPropertyValue(property)); });
      clone.style.color = '#000';
      clone.style.backgroundColor = '#fff';
      if (clone.tagName === 'IMG') {
        if (!element.getBoundingClientRect().width) { clone.removeAttribute('src'); return; }
        var src = element.currentSrc || element.src;
        if (!/^https:\/\/img\.vietqr\.io\//.test(src) && !/^data:image\/(png|jpeg|webp);base64,/.test(src)) throw new Error('Ảnh hóa đơn không hợp lệ');
        if (style.display !== 'none' && element.getBoundingClientRect().width && (!element.complete || !element.naturalWidth)) throw new Error('Ảnh QR chưa tải xong');
        // Reuse the already decoded QR pixels when the source permits canvas access.
        if (element.complete && element.naturalWidth) {
          try {
            var canvas = document.createElement('canvas');
            canvas.width = element.naturalWidth; canvas.height = element.naturalHeight;
            canvas.getContext('2d').drawImage(element, 0, 0);
            src = canvas.toDataURL('image/png');
          } catch (_) { /* The native renderer can use the shared HTTPS image cache. */ }
        }
        clone.src = src;
      }
    });
    copy.querySelectorAll('script,iframe,object,embed,link').forEach(function (element) { element.remove(); });
    // A modal can still be animating (scaleIn) when auto-print starts. Layout
    // width must not include that temporary transform or columns get clipped.
    data.width = Math.ceil(parseFloat(getComputedStyle(paper).width) || paper.offsetWidth);
    copy.style.width = data.width + 'px'; copy.style.maxWidth = 'none'; copy.style.height = 'auto';
    copy.style.margin = '0';
    data.html = '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=' + data.width + '"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data: https://img.vietqr.io; style-src \'unsafe-inline\'"><style>html,body{margin:0;padding:0;background:#fff}body{width:' + data.width + 'px}*{animation:none!important;transition:none!important}</style></head><body>' + copy.outerHTML + '</body></html>';
    return data;
  };
})();
