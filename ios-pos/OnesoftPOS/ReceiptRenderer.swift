import UIKit
import WebKit

/// Dựng bản in từ hóa đơn đã đóng băng, giữ nguyên cột, kiểu dáng và QR.
/// Tương đương ReceiptRenderer.java: WKWebView ẩn (chèn dưới WebView chính),
/// chờ ảnh tải xong, đo chiều cao, rồi chụp từng lát 128 hàng.
final class ReceiptRenderer {
    typealias Completion = (_ slices: [CGImage]?, _ width: Int, _ error: String?) -> Void

    private static let sliceRows = 128
    private static let captureTimeout: TimeInterval = 20
    private static let maxPixels = 24_000

    private var renderer: WKWebView?
    private var pending: Completion?
    private var targetWidth = 0
    private var timeout: DispatchWorkItem?

    private final class Box {
        var slices: [CGImage] = []
    }

    func isBusy() -> Bool { pending != nil }

    /// Dựng html thành danh sách lát ảnh width x 128 hàng (từ trên xuống).
    /// host: view controller chứa WebView chính; renderer được chèn xuống đáy
    /// nên nằm sau WebView chính (trắng, phủ kín) và không bao giờ hiện ra.
    func render(html: String, width: Int, in host: UIViewController, completion: @escaping Completion) {
        if isBusy() {
            completion(nil, width, "Đang chuẩn bị một phiếu in khác")
            return
        }
        pending = completion
        guard html.count <= 2_000_000 else {
            finish(nil, "Hóa đơn quá lớn để dựng bản in")
            return
        }
        targetWidth = width
        let web = WKWebView(frame: CGRect(x: 0, y: 0, width: width, height: width))
        web.backgroundColor = .white
        web.isOpaque = true
        web.navigationDelegate = self
        web.scrollView.bounces = false
        host.view.insertSubview(web, at: 0)
        renderer = web
        armTimeout()
        web.loadHTMLString(html, baseURL: URL(string: "https://onesoft.one/"))
    }

    func close() {
        finish(nil, "Đã dừng chuẩn bị phiếu in")
    }

    // MARK: - Quy trình đo và chụp

    private func armTimeout() {
        timeout?.cancel()
        let item = DispatchWorkItem { [weak self] in
            self?.finish(nil, "Dựng hóa đơn quá thời gian. Kiểm tra kết nối tải QR rồi thử lại.")
        }
        timeout = item
        DispatchQueue.main.asyncAfter(deadline: .now() + Self.captureTimeout, execute: item)
    }

    private static let measureScript = "(function(){var imgs=Array.from(document.images).filter(function(i){return i.getBoundingClientRect().width>0});"
        + "return {ok:imgs.every(function(i){return i.complete&&i.naturalWidth>0}),"
        + "width:document.body.getBoundingClientRect().width,"
        + "height:Math.ceil(document.body.getBoundingClientRect().height)}})()"

    private func measure(_ web: WKWebView) {
        guard let current = renderer else { return }
        current.evaluateJavaScript(Self.measureScript) { [weak self] value, _ in
            guard let self, self.renderer === current else { return }
            guard let size = value as? [String: Any],
                  let ok = (size["ok"] as? NSNumber)?.boolValue,
                  let cssWidth = (size["width"] as? NSNumber)?.doubleValue,
                  let cssHeight = (size["height"] as? NSNumber)?.doubleValue else {
                self.finish(nil, "Không đo được bố cục hóa đơn")
                return
            }
            guard ok else {
                self.finish(nil, "Không tải được QR cho bản in. Vui lòng thử lại.")
                return
            }
            let height = Int((cssHeight * Double(self.targetWidth) / max(cssWidth, 0.001)).rounded(.up))
            guard cssWidth > 0, height > 0, height <= Self.maxPixels else {
                self.finish(nil, "Kích thước hóa đơn không hợp lệ hoặc phiếu quá dài")
                return
            }
            current.frame = CGRect(x: 0, y: 0, width: self.targetWidth, height: height)
            current.setNeedsLayout()
            current.layoutIfNeeded()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self] in
                guard let self, self.renderer === current else { return }
                self.armTimeout()
                self.capture(current, height: height, top: 0, box: Box())
            }
        }
    }

    private func capture(_ current: WKWebView, height: Int, top: Int, box: Box) {
        if renderer == nil || pending == nil { return }
        let rows = min(Self.sliceRows, height - top)
        guard rows > 0 else {
            finish(box.slices, nil)
            return
        }
        let last = top + rows >= height
        let configuration = WKSnapshotConfiguration()
        configuration.rect = CGRect(x: 0, y: CGFloat(top), width: CGFloat(targetWidth), height: CGFloat(rows))
        configuration.afterScreenUpdates = true
        current.takeSnapshot(with: configuration) { [weak self] image, error in
            guard let self, self.renderer === current, self.pending != nil else { return }
            guard let image = image, let cgImage = image.cgImage else {
                self.finish(nil, "Không dựng được ảnh hóa đơn: \(error?.localizedDescription ?? "lỗi không rõ")")
                return
            }
            box.slices.append(cgImage)
            if last {
                self.finish(box.slices, nil)
            } else {
                self.capture(current, height: height, top: top + Self.sliceRows, box: box)
            }
        }
    }

    private func finish(_ slices: [CGImage]?, _ error: String?) {
        let callback = pending
        pending = nil
        timeout?.cancel()
        timeout = nil
        if let web = renderer {
            web.stopLoading()
            web.removeFromSuperview()
            renderer = nil
        }
        if let callback {
            callback(slices, targetWidth, error)
        }
    }
}

// MARK: - WKNavigationDelegate

extension ReceiptRenderer: WKNavigationDelegate {
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        // Chặn mọi điều hướng (như shouldOverrideUrlLoading=true của Android);
        // tài nguyên con bị giới hạn bởi CSP của chính tài liệu snapshot.
        if let url = navigationAction.request.url, url.absoluteString == "https://onesoft.one/" {
            decisionHandler(.allow)
        } else {
            decisionHandler(.cancel)
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self] in
            guard let self, self.renderer === webView else { return }
            self.measure(webView)
        }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        if renderer === webView {
            finish(nil, "Không dựng được bản in HTML: \(error.localizedDescription)")
        }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        if renderer === webView {
            finish(nil, "Không dựng được bản in HTML: \(error.localizedDescription)")
        }
    }
}
