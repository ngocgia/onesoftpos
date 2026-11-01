import UIKit
import WebKit

/// Màn hình POS: WKWebView tải https://onesoft.one/?mode=pos cùng cầu nối
/// in ấn + âm thanh. Port 1:1 từ MainActivity.java của bản Android;
/// Bluetooth/USB/RawBT không có trên iPhone nên chỉ hỗ trợ LAN và trình duyệt.
final class ViewController: UIViewController {
    private static let host = "onesoft.one"
    private static let posUrl = URL(string: "https://onesoft.one/?mode=pos")!

    private static let clearAdminSessionScript = "(function(){"
        + "localStorage.removeItem('onesoftpos_token');"
        + "localStorage.removeItem('onesoftpos_store_id');"
        // Xóa cả session trước khi đổi tên để không thể khôi phục lại sau này.
        + "localStorage.removeItem('thichgapos_token');"
        + "localStorage.removeItem('thichgapos_store_id');"
        + "sessionStorage.clear();"
        + "})()"

    // Âm thanh chạy qua cầu nối native để thông báo không làm hỏng điều hướng in tgpos://.
    private static let appBridgeScript = "(function(){"
        + "window.onesoftAudio={"
        + "beep:function(v){window.webkit.messageHandlers.onesoftAudio.postMessage({op:'beep',volume:Number(v)||0})},"
        + "speak:function(t,v){window.webkit.messageHandlers.onesoftAudio.postMessage({op:'speak',text:String(t),volume:Number(v)||0})}};"
        + "window.onesoftNativePrint=false;"
        + "window.onesoftNativeRawBt=false;"
        + "window.onesoftNativeLanPrint=true;"
        + "window.onesoftNativeReceiptQr=true;"
        + "window.print=function(){var paper=(window.appState&&window.appState.storeSettings&&window.appState.storeSettings.receipt_paper_size)||'80mm';"
        + "try{if(window.onesoftBuildReceiptSnapshot)window.onesoftPendingReceipt=window.onesoftBuildReceiptSnapshot()}catch(e){alert('Không chuẩn bị được hóa đơn: '+e.message);return;}"
        + "var connection=(window.appState&&window.appState.storeSettings&&window.appState.storeSettings.receipt_connection_type)||'browser';"
        + "var cut=!(window.appState&&window.appState.storeSettings&&window.appState.storeSettings.receipt_auto_cut_paper===false);"
        + "var ip=(window.appState&&window.appState.storeSettings&&window.appState.storeSettings.receipt_ip_address)||'';"
        + "window.location.href='tgpos://print?paper='+encodeURIComponent(paper)+'&connection='+encodeURIComponent(connection)+'&cut='+(cut?'1':'0')+'&ip='+encodeURIComponent(ip)}"
        + "})()"

    // Đọc dữ liệu hóa đơn chờ in, kèm nhánh dự phòng cho web cũ (như MainActivity.java).
    private static let pendingReceiptScript = "(function(){"
        + "var saved=window.menuPersistence&&typeof window.menuPersistence.read==='function'?window.menuPersistence.read('printer',{}):{};"
        + "return window.onesoftPendingReceipt||{"
        + "text:window.invoiceModule&&window.invoiceModule.receiptText||'',"
        + "qrUrl:window.invoiceModule&&window.invoiceModule.receiptQrUrl||'',"
        + "footer:window.invoiceModule&&window.invoiceModule.receiptFooterText||'',"
        + "ip:window.appState&&window.appState.storeSettings&&window.appState.storeSettings.receipt_ip_address||saved.ipAddress||''}})()"

    private var receiptSnapshotScript = "void 0"

    private var webView: WKWebView!
    private var progress: UIActivityIndicatorView!
    private var errorView: UIView!
    private var toastContainer: UIView!
    private var toastLabel: UILabel!
    private var toastWork: DispatchWorkItem?
    private var progressObserver: NSKeyValueObservation?

    private var loadFailed = false
    private var pageLoaded = false
    private var lastAllowedUrl: URL?

    private var speaker: NativeSpeaker!
    private var thermalPrinter: ThermalPrinter!
    private let receiptRenderer = ReceiptRenderer()

    // MARK: - Vòng đời

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .white

        speaker = NativeSpeaker(message: { [weak self] text in self?.toast(text) })
        thermalPrinter = ThermalPrinter(message: { [weak self] text in self?.toast(text) })

        let configuration = WKWebViewConfiguration()
        configuration.userContentController.add(WeakScriptMessageHandler(delegate: self), name: "onesoftAudio")
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.allowsInlineMediaPlayback = true

        webView = WKWebView(frame: view.bounds, configuration: configuration)
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.backgroundColor = .white
        webView.scrollView.bounces = false
        webView.scrollView.alwaysBounceVertical = false
        view.addSubview(webView)

        progress = UIActivityIndicatorView(style: .large)
        progress.color = .darkGray
        progress.hidesWhenStopped = true
        view.addSubview(progress)

        errorView = buildErrorView()
        view.addSubview(errorView)

        toastContainer = buildToastContainer()
        view.bringSubviewToFront(toastContainer)

        progressObserver = webView.observe(\.estimatedProgress, options: [.new]) { [weak self] _, change in
            DispatchQueue.main.async {
                guard let self else { return }
                let value = change.newValue ?? 0
                // Một liên kết tgpos:// đã xử lý có thể phát progress mà không có
                // tài liệu/onPageFinished mới — đừng hồi sinh spinner vì nó.
                let working = !self.pageLoaded && !self.loadFailed && value < 1
                if working { self.progress.startAnimating() } else { self.progress.stopAnimating() }
            }
        }

        if let url = Bundle.main.url(forResource: "receipt-snapshot", withExtension: "js"),
           let script = try? String(contentsOf: url, encoding: .utf8) {
            receiptSnapshotScript = script
        }

        loadPos()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        progress.center = view.center
        layoutErrorView()
    }

    override func viewSafeAreaInsetsDidChange() {
        super.viewSafeAreaInsetsDidChange()
        applyInsetsToWebView()
    }

    deinit {
        progressObserver?.invalidate()
        thermalPrinter?.close()
        speaker?.close()
        receiptRenderer.close()
    }

    private func loadPos() {
        webView.load(URLRequest(url: Self.posUrl))
    }

    // MARK: - Kiểm tra URL

    private func isAppHost(_ url: URL) -> Bool {
        url.scheme?.lowercased() == "https" && url.host?.lowercased() == Self.host
    }

    private func isAdminPath(_ url: URL) -> Bool {
        guard isAppHost(url) else { return false }
        let path = url.path
        return path == "/admin" || path == "/admin.html" || path.hasPrefix("/admin/")
    }

    // MARK: - Chèn CSS biến vùng an toàn (như applyInsetsToWebView của Android)

    private func applyInsetsToWebView() {
        guard pageLoaded, webView != nil else { return }
        let top = Int(view.safeAreaInsets.top.rounded())
        let bottom = Int(view.safeAreaInsets.bottom.rounded())
        let left = Int(view.safeAreaInsets.left.rounded())
        let right = Int(view.safeAreaInsets.right.rounded())
        let js = String(
            format: "(function(){"
                + "var top='%dpx',bottom='%dpx',left='%dpx',right='%dpx';"
                + "var d=document.documentElement;"
                + "if(d){"
                + "d.style.setProperty('--android-inset-top',top);"
                + "d.style.setProperty('--android-inset-bottom',bottom);"
                + "d.style.setProperty('--android-inset-left',left);"
                + "d.style.setProperty('--android-inset-right',right);"
                + "d.style.setProperty('--safe-top',top);"
                + "d.style.setProperty('--safe-bottom',bottom);"
                + "d.style.setProperty('--safe-left',left);"
                + "d.style.setProperty('--safe-right',right);"
                + "}"
                + "var st=document.getElementById('android-e2e-style');"
                + "if(!st&&document.head){"
                + "st=document.createElement('style');"
                + "st.id='android-e2e-style';"
                + "document.head.appendChild(st);"
                + "}"
                + "if(st){"
                + "st.textContent='@media(max-width:520px){"
                + ":root{--header-height:calc(58px + '+top+')!important;--bottom-nav-height:calc(64px + '+bottom+')!important;}"
                + ".top-header{min-height:calc(58px + '+top+')!important;padding-top:'+top+'!important;}"
                + ".bottom-nav-bar{min-height:calc(64px + '+bottom+')!important;height:calc(64px + '+bottom+')!important;padding-bottom:'+bottom+'!important;}"
                + ".main-content{margin-bottom:calc(64px + '+bottom+')!important;}"
                + "}';"
                + "}"
                + "})()",
            top, bottom, left, right)
        webView.evaluateJavaScript(js, completionHandler: nil)
    }

    // MARK: - Chặn admin và quay về đăng nhập POS

    private func returnToPosLogin() {
        webView.stopLoading()
        webView.evaluateJavaScript(Self.clearAdminSessionScript) { [weak self] _, _ in
            guard let self else { return }
            self.loadPos()
            self.toast("Ứng dụng chỉ dành cho nhân viên POS, không hỗ trợ tài khoản quản trị.")
        }
    }

    // MARK: - Xử lý liên kết in tgpos://print

    private func handlePrintUrl(_ url: URL) {
        guard let sourceUrl = webView.url, isAppHost(sourceUrl) else { return }
        if receiptRenderer.isBusy() || thermalPrinter.isBusy() {
            toast("Đang xử lý phiếu in. Vui lòng chờ.")
            return
        }
        let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
        func param(_ name: String) -> String {
            items.first(where: { $0.name == name })?.value ?? ""
        }
        let paper = param("paper")
        let connection = param("connection")
        let autoCut = param("cut") != "0"
        let ipAddress = param("ip")

        let directConnections = ["bluetooth", "usb", "rawbt", "lan", "network"]
        if directConnections.contains(connection) {
            guard ["58mm", "80mm", "85mm"].contains(paper) else {
                toast("Chọn khổ K58, K80 hoặc K85 để in nhiệt")
                return
            }
            if connection == "bluetooth" {
                toast("iPhone không in được qua Bluetooth. Hãy chọn Mạng LAN (Wi-Fi) hoặc Trình duyệt trong Cài đặt máy in.")
                return
            }
            if connection == "usb" {
                toast("iPhone không kết nối được máy in USB. Hãy chọn Mạng LAN (Wi-Fi) hoặc Trình duyệt trong Cài đặt máy in.")
                return
            }
            if connection == "rawbt" {
                toast("RawBT chỉ có trên Android. Hãy chọn Mạng LAN (Wi-Fi) hoặc Trình duyệt trong Cài đặt máy in.")
                return
            }
            startLanPrint(paper: paper, connection: connection, autoCut: autoCut, ipAddress: ipAddress, sourceUrl: sourceUrl)
        } else if connection == "browser" {
            startBrowserPrint(paper: paper, sourceUrl: sourceUrl)
        } else {
            toast("Phương thức in không hợp lệ. Hãy mở lại cài đặt máy in.")
        }
    }

    private func startLanPrint(paper: String, connection: String, autoCut: Bool, ipAddress: String, sourceUrl: URL) {
        webView.evaluateJavaScript(Self.pendingReceiptScript) { [weak self] value, _ in
            guard let self else { return }
            guard self.webView.url == sourceUrl else { return }
            guard let data = value as? [String: Any] else {
                self.toast("Chưa đọc được dữ liệu hóa đơn. Hãy mở lại phiếu.")
                return
            }
            let html = data["html"] as? String ?? ""
            let text = data["text"] as? String ?? ""
            let qrUrl = data["qrUrl"] as? String ?? ""
            let footer = data["footer"] as? String ?? ""
            let fallbackIp = data["ip"] as? String ?? ""
            let resolvedIp = ipAddress.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? fallbackIp : ipAddress
            if !html.isEmpty {
                // Đóng băng DOM rồi mới gửi đi, giữ nguyên cột/kiểu dáng/QR.
                self.receiptRenderer.render(html: html, width: paper == "58mm" ? 384 : 576, in: self) { [weak self] slices, _, error in
                    guard let self, self.webView.url == sourceUrl else { return }
                    if let error {
                        self.toast(error)
                        return
                    }
                    guard let slices, !slices.isEmpty else {
                        self.toast("Chưa đọc được dữ liệu hóa đơn. Hãy mở lại phiếu.")
                        return
                    }
                    // Rà lại cửa hàng trước khi in: hóa đơn có thể thuộc phiên khác.
                    let storeId = data["storeId"] as? String ?? ""
                    let sameStore = "String(window.api&&window.api.getCurrentStoreId?window.api.getCurrentStoreId():'')==" + Self.jsonQuote(storeId)
                    self.webView.evaluateJavaScript(sameStore) { [weak self] valid, _ in
                        guard let self else { return }
                        if !Self.isTruthy(valid) || self.webView.url != sourceUrl {
                            self.toast("Cửa hàng đã thay đổi. Hãy mở lại phiếu.")
                            return
                        }
                        self.thermalPrinter.print(slices: slices, paper: paper, cutPaper: autoCut, ipAddress: resolvedIp)
                    }
                }
            } else {
                self.thermalPrinter.print(receipt: text, paper: paper, receiptQrUrl: qrUrl,
                                          receiptFooter: footer, cutPaper: autoCut, ipAddress: resolvedIp)
            }
        }
    }

    /// In qua hộp thoại hệ thống (AirPrint/driver): dựng ảnh hóa đơn rồi đưa vào
    /// UIPrintInteractionController, tương đương PrintManager của Android.
    private func startBrowserPrint(paper: String, sourceUrl: URL) {
        webView.evaluateJavaScript(Self.pendingReceiptScript) { [weak self] value, _ in
            guard let self else { return }
            guard self.webView.url == sourceUrl else { return }
            guard let data = value as? [String: Any], let html = data["html"] as? String, !html.isEmpty else {
                self.toast("Chưa đọc được dữ liệu hóa đơn. Hãy mở lại phiếu.")
                return
            }
            let width = paper == "58mm" ? 384 : (paper == "A4" ? 794 : 576)
            self.receiptRenderer.render(html: html, width: width, in: self) { [weak self] slices, _, error in
                guard let self else { return }
                if let error {
                    self.toast(error)
                    return
                }
                guard let slices, !slices.isEmpty else {
                    self.toast("Chưa đọc được dữ liệu hóa đơn. Hãy mở lại phiếu.")
                    return
                }
                guard let image = Self.stitch(slices: slices) else {
                    self.toast("Không dựng được ảnh hóa đơn")
                    return
                }
                self.presentPrintDialog(image: image)
            }
        }
    }

    private func presentPrintDialog(image: UIImage) {
        let controller = UIPrintInteractionController.shared
        let info = UIPrintInfo(dictionary: nil)
        info.outputType = .grayscale
        info.jobName = "Onesoft POS - Hóa đơn"
        info.orientation = .portrait
        controller.printInfo = info
        controller.printingItem = image
        controller.present(animated: true) { [weak self] _, completed, error in
            if let error {
                self?.toast("Không mở được màn hình in: \(error.localizedDescription)")
            } else if !completed {
                self?.toast("Đã hủy lệnh in.")
            }
        }
    }

    // MARK: - Tiện ích JS

    private static func jsonQuote(_ value: String) -> String {
        let encoded = (try? JSONEncoder().encode(value)) ?? Data("".utf8)
        return String(data: encoded, encoding: .utf8) ?? "\"\""
    }

    private static func isTruthy(_ value: Any?) -> Bool {
        if let bool = value as? Bool { return bool }
        if let number = value as? NSNumber { return number.boolValue }
        if let string = value as? String { return string == "true" }
        return false
    }

    /// Ghép các lát ảnh thành một ảnh dài (dùng cho hộp thoại in hệ thống).
    private static func stitch(slices: [CGImage]) -> UIImage? {
        guard let first = slices.first else { return nil }
        let width = first.width
        let totalHeight = slices.reduce(0) { $0 + $1.height }
        guard totalHeight > 0 else { return nil }
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: CGFloat(width), height: CGFloat(totalHeight)), format: format)
        return renderer.image { context in
            UIColor.white.setFill()
            context.fill(CGRect(x: 0, y: 0, width: CGFloat(width), height: CGFloat(totalHeight)))
            var y = 0
            for slice in slices {
                UIImage(cgImage: slice).draw(at: CGPoint(x: 0, y: CGFloat(y)))
                y += slice.height
            }
        }
    }

    // MARK: - Giao diện lỗi / tiến trình / toast

    private func buildErrorView() -> UIView {
        let container = UIView()
        container.backgroundColor = .white
        container.isHidden = true

        let label = UILabel()
        label.text = "Không tải được Onesoft POS. Hãy kiểm tra kết nối mạng."
        label.textColor = .darkGray
        label.font = .systemFont(ofSize: 17)
        label.numberOfLines = 0
        label.textAlignment = .center

        var configuration = UIButton.Configuration.filled()
        configuration.title = "Thử lại"
        configuration.baseBackgroundColor = view.tintColor
        let button = UIButton(configuration: configuration)
        button.addTarget(self, action: #selector(retryTapped), for: .touchUpInside)

        let stack = UIStackView(arrangedSubviews: [label, button])
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 16
        stack.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 32),
            stack.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -32),
            stack.centerYAnchor.constraint(equalTo: container.centerYAnchor),
        ])
        return container
    }

    private func layoutErrorView() {
        errorView.frame = view.bounds
    }

    @objc private func retryTapped() {
        loadPos()
    }

    private func buildToastContainer() -> UIView {
        let container = UIView()
        container.backgroundColor = UIColor(white: 0, alpha: 0.78)
        container.layer.cornerRadius = 10
        container.clipsToBounds = true
        container.isUserInteractionEnabled = false
        container.isHidden = true

        toastLabel = UILabel()
        toastLabel.textColor = .white
        toastLabel.font = .systemFont(ofSize: 15, weight: .medium)
        toastLabel.numberOfLines = 0
        toastLabel.textAlignment = .center
        toastLabel.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(toastLabel)
        NSLayoutConstraint.activate([
            toastLabel.topAnchor.constraint(equalTo: container.topAnchor, constant: 10),
            toastLabel.bottomAnchor.constraint(equalTo: container.bottomAnchor, constant: -10),
            toastLabel.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 14),
            toastLabel.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -14),
        ])
        return container
    }

    /// Thông báo nhanh thay cho Toast của Android.
    private func toast(_ text: String) {
        if Thread.isMainThread {
            showToast(text)
        } else {
            DispatchQueue.main.async { [weak self] in self?.showToast(text) }
        }
    }

    private func showToast(_ text: String) {
        toastWork?.cancel()
        toastLabel.text = text
        toastContainer.layoutIfNeeded()
        toastContainer.isHidden = false
        toastContainer.alpha = 0
        let maxWidth = min(view.bounds.width - 32, 360)
        let size = toastLabel.systemLayoutSizeFitting(
            CGSize(width: maxWidth - 28, height: UIView.layoutFittingCompressedSize.height),
            withHorizontalFittingPriority: .required,
            verticalFittingPriority: .fittingSizeLevel)
        let width = size.width + 28
        let height = size.height + 20
        let bottom = view.bounds.height - view.safeAreaInsets.bottom - 96
        toastContainer.frame = CGRect(x: (view.bounds.width - width) / 2, y: bottom - height, width: width, height: height)
        UIView.animate(withDuration: 0.2) { self.toastContainer.alpha = 1 }
        let work = DispatchWorkItem { [weak self] in
            UIView.animate(withDuration: 0.3) { self?.toastContainer.alpha = 0 } completion: { _ in
                if self?.toastWork?.isCancelled != true { self?.toastContainer.isHidden = true }
            }
        }
        toastWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.5, execute: work)
    }

    // MARK: - Điều hướng thất bại

    private func handleMainFrameFailure() {
        guard let url = lastAllowedUrl, isAppHost(url) else { return }
        loadFailed = true
        pageLoaded = false
        progress.stopAnimating()
        webView.isHidden = true
        errorView.isHidden = false
    }
}

// MARK: - WKNavigationDelegate

extension ViewController: WKNavigationDelegate {
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }
        // Liên kết in từ window.print đã được override.
        if url.scheme?.lowercased() == "tgpos" {
            if url.host?.lowercased() == "print" {
                handlePrintUrl(url)
            }
            decisionHandler(.cancel)
            return
        }
        let isMainFrame = navigationAction.targetFrame?.isMainFrame ?? false
        let isNewWindow = navigationAction.targetFrame == nil
        if isMainFrame || isNewWindow {
            if isAppHost(url) {
                if isAdminPath(url) {
                    returnToPosLogin()
                    decisionHandler(.cancel)
                    return
                }
                if isNewWindow {
                    webView.load(URLRequest(url: url))
                    decisionHandler(.cancel)
                    return
                }
                lastAllowedUrl = url
                decisionHandler(.allow)
                return
            }
            // Liên kết ngoài mở bằng Safari (như ACTION_VIEW của Android).
            if url.scheme?.lowercased() == "https" {
                UIApplication.shared.open(url, options: [:], completionHandler: nil)
            }
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        // Tương đương onPageStarted: chỉ khung chính của trang app.
        guard let url = webView.url, isAppHost(url) else { return }
        loadFailed = false
        pageLoaded = false
        errorView.isHidden = true
        webView.isHidden = true
        progress.startAnimating()
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard let url = webView.url else { return }
        if isAdminPath(url) {
            returnToPosLogin()
            return
        }
        if loadFailed || !isAppHost(url) { return }
        let urlString = url.absoluteString
        pageLoaded = true
        applyInsetsToWebView()
        webView.evaluateJavaScript(receiptSnapshotScript + ";" + Self.appBridgeScript) { [weak self] _, _ in
            guard let self, self.webView.url?.absoluteString == urlString else { return }
            self.progress.stopAnimating()
            self.webView.isHidden = false
        }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        handleMainFrameFailure()
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        handleMainFrameFailure()
    }
}

// MARK: - WKUIDelegate (alert/confirm từ trang web)

extension ViewController: WKUIDelegate {
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
        alert.addAction(UIAlertAction(title: "Hủy", style: .cancel) { _ in completionHandler(false) })
        present(alert, animated: true)
    }
}

// MARK: - Cầu nối âm thanh từ JS

extension ViewController: WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "onesoftAudio", let body = message.body as? [String: Any] else { return }
        // Chỉ phát khi trang hiện tại là của app (như kiểm tra host của Android).
        guard let url = webView.url, isAppHost(url) else { return }
        let volume = (body["volume"] as? NSNumber)?.intValue ?? 0
        switch body["op"] as? String {
        case "beep":
            speaker.beep(volume: volume)
        case "speak":
            speaker.speak(body["text"] as? String ?? "", volume: volume)
        default:
            break
        }
    }
}

/// WKUserContentController giữ mạnh script message handler; dùng proxy yếu
/// để không tạo vòng giữ với ViewController.
private final class WeakScriptMessageHandler: NSObject, WKScriptMessageHandler {
    private weak var delegate: WKScriptMessageHandler?

    init(delegate: WKScriptMessageHandler) {
        self.delegate = delegate
        super.init()
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        delegate?.userContentController(userContentController, didReceive: message)
    }
}
