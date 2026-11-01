import Foundation
import ImageIO
import Network
import UIKit

/// Gửi hóa đơn Unicode dạng raster đơn sắc qua mạng LAN (cổng 9100),
/// không phụ thuộc bảng mã máy in. Tương đương nhánh sendNetwork của
/// ThermalPrinter.java; Bluetooth/USB/RawBT không thể có trên iPhone.
final class ThermalPrinter {
    private let worker = DispatchQueue(label: "vn.pro.giavdn.onesoftpos.printer", qos: .userInitiated)
    private let message: (String) -> Void
    private var busy = false
    private var closed = false
    private var activeConnection: NWConnection?

    private var text = ""
    private var qrUrl = ""
    private var footer = ""
    private var width = 576
    private var autoCut = false
    private var slices: [CGImage]?

    init(message: @escaping (String) -> Void) {
        self.message = message
    }

    func isBusy() -> Bool { busy }

    func close() {
        closed = true
        activeConnection?.cancel()
    }

    /// In đường dẫn chính: hóa đơn đã dựng sẵn thành các lát ảnh (từ ReceiptRenderer).
    func print(slices: [CGImage], paper: String, cutPaper: Bool, ipAddress: String?) {
        startJob(receipt: "", paper: paper, receiptQrUrl: "", receiptFooter: "", cutPaper: cutPaper, ipAddress: ipAddress, slices: slices)
    }

    /// In đường dẫn dự phòng văn bản thuần (web cũ không tạo được snapshot HTML),
    /// tự tải QR từ img.vietqr.io rồi dựng raster như bản Android.
    func print(receipt: String, paper: String, receiptQrUrl: String, receiptFooter: String,
               cutPaper: Bool, ipAddress: String?) {
        startJob(receipt: receipt, paper: paper, receiptQrUrl: receiptQrUrl, receiptFooter: receiptFooter,
                 cutPaper: cutPaper, ipAddress: ipAddress, slices: nil)
    }

    private func startJob(receipt: String, paper: String, receiptQrUrl: String, receiptFooter: String,
                          cutPaper: Bool, ipAddress: String?, slices: [CGImage]?) {
        guard !closed else { return }
        guard !busy else {
            message("Đang xử lý một phiếu in. Vui lòng chờ.")
            return
        }
        let receiptEmpty = receipt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        guard !receiptEmpty || slices != nil else {
            message("Chưa có dữ liệu hóa đơn")
            return
        }
        text = receipt
        qrUrl = receiptQrUrl
        footer = receiptFooter
        autoCut = cutPaper
        self.slices = slices
        // K80/K85 dùng raster 72mm an toàn cho tới khi biết chính xác độ rộng đầu in.
        width = paper == "58mm" ? 384 : 576
        busy = true
        sendNetwork(address: ipAddress)
    }

    // MARK: - Gửi qua LAN

    private func sendNetwork(address: String?) {
        let host: String
        do {
            host = try PrinterNetworkAddress.parse(address)
        } catch {
            stop(error.localizedDescription)
            return
        }
        message("Đang kết nối máy in LAN \(host):9100...")
        worker.async { [weak self] in
            self?.runNetworkJob(host: host)
        }
    }

    private func runNetworkJob(host: String) {
        let lock = DispatchQueue(label: "vn.pro.giavdn.onesoftpos.printer.job")
        var ready = false
        var sent = false
        var failure: String?
        let done = DispatchSemaphore(value: 0)
        let fail: (String) -> Void = { text in
            lock.sync {
                if failure == nil { failure = text }
            }
        }
        let lanError: (String) -> String = { detail in
            "In LAN thất bại (\(host):9100): \(detail). Kiểm tra cùng mạng Wi-Fi/LAN và cổng in 9100. Kiểm tra giấy trước khi in lại để tránh trùng."
        }

        let connection = NWConnection(host: NWEndpoint.Host(host), port: NWEndpoint.Port(rawValue: 9100)!,
                                      using: .tcp)
        activeConnection = connection
        var finished = false
        let finishAll = {
            lock.sync {
                if !finished {
                    finished = true
                    done.signal()
                }
            }
        }

        connection.stateUpdateHandler = { [weak self] state in
            switch state {
            case .ready:
                lock.sync { ready = true }
                guard let self, !self.closed else {
                    connection.cancel()
                    return
                }
                do {
                    let payload = try self.buildPayload()
                    connection.send(content: Data(payload), contentContext: .defaultMessage, isComplete: true,
                                    completion: .contentProcessed { error in
                        if let error {
                            fail(lanError(error.localizedDescription))
                        } else {
                            lock.sync { sent = true }
                        }
                        connection.cancel()
                    })
                } catch {
                    fail("Chuẩn bị dữ liệu in thất bại: \(error.localizedDescription)")
                    connection.cancel()
                }
            case .failed(let error):
                fail(lanError(error.localizedDescription))
                finishAll()
            case .cancelled:
                finishAll()
            default:
                break
            }
        }
        connection.start(queue: DispatchQueue(label: "vn.pro.giavdn.onesoftpos.printer.nw"))

        // 5 giây cho kết nối, 90 giây ngân sách tổng cho toàn bộ phiếu (như Android).
        DispatchQueue.global().asyncAfter(deadline: .now() + 5) {
            let state = lock.sync { (ready: ready, finished: finished) }
            if !state.ready && !state.finished {
                fail(lanError("hết 5 giây chưa kết nối được"))
                connection.cancel()
            }
        }
        DispatchQueue.global().asyncAfter(deadline: .now() + 90) {
            let state = lock.sync { (sent: sent, finished: finished) }
            if !state.sent && !state.finished {
                fail(lanError("quá 90 giây chưa gửi xong"))
                connection.cancel()
            }
        }

        _ = done.wait(timeout: .now() + 100)
        activeConnection = nil
        let outcome = lock.sync { (sent: sent, failure: failure) }
        if outcome.sent {
            message("Đã gửi dữ liệu tới máy in LAN. Vui lòng kiểm tra giấy in.")
        } else {
            message(outcome.failure ?? lanError("không rõ lỗi"))
        }
        DispatchQueue.main.async { [weak self] in self?.busy = false }
    }

    private func stop(_ text: String) {
        busy = false
        message(text)
    }

    // MARK: - Dựng payload ESC/POS

    private func buildPayload() throws -> [UInt8] {
        var payload: [UInt8] = [27, 64, 27, 97, 0] // ESC @ (đặt lại) + ESC a 0 (căn trái)
        if let slices {
            // Đường dẫn chính: mã hóa từng lát ảnh đã dựng sẵn. Ảnh chụp mang
            // tỉ lệ màn hình (2x/3x) nên suy số hàng CSS từ tỉ lệ thực của lát.
            for slice in slices {
                guard slice.width > 0 else { throw PayloadError("Không dựng được ảnh hóa đơn") }
                let rows = Int((Double(slice.height) * Double(width) / Double(slice.width)).rounded())
                guard rows > 0, rows <= 65535,
                      let pixels = BitmapPixels.rgba(from: slice, width: width, height: rows) else {
                    throw PayloadError("Không dựng được ảnh hóa đơn")
                }
                payload += try EscPosRaster.encodeRows(pixels: pixels, width: width, firstRow: 0, rowCount: rows)
            }
            payload += EscPosRaster.finish(autoCut: autoCut)
            return payload
        }

        // Đường dẫn dự phòng: tải QR TRƯỚC khi gửi bất kỳ byte giấy nào,
        // để lỗi tải QR không in ra phiếu thiếu.
        var qrImage: CGImage?
        if !qrUrl.isEmpty {
            qrImage = try downloadQr(urlString: qrUrl)
        }
        try appendText(text, into: &payload)
        if let qrImage {
            let size = 304 // 38mm ở 203dpi, gồm cả vùng yên tĩnh của QR.
            let scaled = try resample(image: qrImage, width: size, height: size)
            try appendQr(scaled, size: size, into: &payload)
            if !footer.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                try appendText(footer, into: &payload)
            }
        }
        payload += EscPosRaster.finish(autoCut: autoCut)
        return payload
    }

    private struct PayloadError: Error, CustomStringConvertible {
        let description: String
        init(_ text: String) { description = text }
    }

    // MARK: - Vẽ văn bản và QR thành raster

    /// Vẽ văn bản thuần thành bitmap rồi gửi từng dải 64 hàng (như StaticLayout của Android).
    private func appendText(_ value: String, into payload: inout [UInt8]) throws {
        let fontSize: CGFloat = width == 384 ? 22 : 26
        let font = UIFont.systemFont(ofSize: fontSize)
        let paragraph = NSMutableParagraphStyle()
        paragraph.lineSpacing = 3
        let attributed = NSAttributedString(string: value, attributes: [
            .font: font,
            .foregroundColor: UIColor.black,
            .paragraphStyle: paragraph,
        ])
        let layoutWidth = CGFloat(width - 16)
        let bounding = attributed.boundingRect(
            with: CGSize(width: layoutWidth, height: .greatestFiniteMagnitude),
            options: [.usesLineFragmentOrigin, .usesFontLeading],
            context: nil)
        let height = Int(ceil(bounding.height)) + 4
        guard height > 0, height <= 12_000 else {
            throw PayloadError("Kích thước hóa đơn không hợp lệ hoặc phiếu quá dài")
        }
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: width, height: CGFloat(height)), format: format)
        let image = renderer.image { context in
            UIColor.white.setFill()
            context.fill(CGRect(x: 0, y: 0, width: CGFloat(width), height: CGFloat(height)))
            attributed.draw(at: CGPoint(x: 8, y: 2))
        }
        guard let cgImage = image.cgImage,
              let pixels = BitmapPixels.rgba(from: cgImage, width: width, height: height) else {
            throw PayloadError("Không dựng được ảnh chữ")
        }
        // Gửi từng dải 64 hàng = 8mm ở 203dpi để máy in kịp xả bộ đệm.
        var top = 0
        while top < height {
            let rows = min(64, height - top)
            payload += try EscPosRaster.encodeRows(pixels: pixels, width: width, firstRow: top, rowCount: rows)
            top += rows
        }
    }

    private func appendQr(_ image: CGImage, size: Int, into payload: inout [UInt8]) throws {
        var top = 0
        while top < size {
            let rows = min(64, size - top)
            let format = UIGraphicsImageRendererFormat()
            format.scale = 1
            let renderer = UIGraphicsImageRenderer(size: CGSize(width: width, height: CGFloat(rows)), format: format)
            let strip = renderer.image { context in
                UIColor.white.setFill()
                context.fill(CGRect(x: 0, y: 0, width: CGFloat(width), height: CGFloat(rows)))
                UIImage(cgImage: image).draw(at: CGPoint(x: CGFloat((width - size) / 2), y: CGFloat(-top)))
            }
            guard let cgImage = strip.cgImage,
                  let pixels = BitmapPixels.rgba(from: cgImage, width: width, height: rows) else {
                throw PayloadError("Không dựng được ảnh QR")
            }
            payload += try EscPosRaster.encodeRows(pixels: pixels, width: width, firstRow: 0, rowCount: rows)
            top += rows
        }
    }

    private func resample(image: CGImage, width: Int, height: Int) throws -> CGImage {
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: width, height: height), format: format)
        let output = renderer.image { context in
            UIColor.white.setFill()
            context.fill(CGRect(x: 0, y: 0, width: CGFloat(width), height: CGFloat(height)))
            UIImage(cgImage: image).draw(in: CGRect(x: 0, y: 0, width: CGFloat(width), height: CGFloat(height)))
        }
        guard let result = output.cgImage else { throw PayloadError("Không co giãn được ảnh QR") }
        return result
    }

    // MARK: - Tải QR

    /// Chỉ nhận https://img.vietqr.io (cổng 443), không theo redirect,
    /// thời hạn 15 giây, ảnh tối thiểu 100x100 — như bản Android.
    private func downloadQr(urlString: String) throws -> CGImage {
        guard let url = URL(string: urlString), url.scheme?.lowercased() == "https",
              url.host?.lowercased() == "img.vietqr.io", url.port == nil || url.port == 443 else {
            throw PayloadError("Địa chỉ QR không hợp lệ")
        }
        let delegate = NoRedirectDelegate()
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 15
        configuration.timeoutIntervalForResource = 15
        let session = URLSession(configuration: configuration, delegate: delegate, delegateQueue: nil)
        defer { session.finishTasksAndInvalidate() }
        let semaphore = DispatchSemaphore(value: 0)
        var loaded: Data?
        var failure: String = "Không tải được QR thanh toán"
        let task = session.dataTask(with: url) { data, response, error in
            if let error {
                failure = "Không tải được QR thanh toán: \(error.localizedDescription)"
            } else if let http = response as? HTTPURLResponse, http.statusCode != 200 {
                failure = "Không tải được QR thanh toán (mã \(http.statusCode))"
            } else if let data {
                loaded = data
            }
            semaphore.signal()
        }
        task.resume()
        _ = semaphore.wait(timeout: .now() + 20)
        guard let data = loaded else { throw PayloadError(failure) }
        guard let source = CGImageSourceCreateWithData(data as CFData, nil),
              let image = CGImageSourceCreateImageAtIndex(source, 0, nil),
              image.width >= 100, image.height >= 100 else {
            throw PayloadError("Ảnh QR không hợp lệ")
        }
        return image
    }
}

/// Từ chối redirect khi tải QR (tương đương setInstanceFollowRedirects(false)).
private final class NoRedirectDelegate: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask,
                    willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest,
                    completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}
