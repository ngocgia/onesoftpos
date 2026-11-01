import Foundation

/// Bộ mã hóa thuần túy để có thể kiểm tra đóng gói byte mà không cần phần cứng.
/// Port 1:1 từ EscPosRaster.java của bản Android.
enum EscPosRaster {
    enum RasterError: Error, CustomStringConvertible {
        case invalidDimensions

        var description: String {
            switch self {
            case .invalidDimensions: return "Invalid raster dimensions"
            }
        }
    }

    /// ESC d 1: chừa một dòng sau chân hóa đơn. GS V 66 0 tiến giấy tới dao cắt
    /// trước khi cắt; bốn dòng thừa làm lãng phí giấy.
    /// Gửi một lần sau toàn bộ chữ, QR và chân; không bao giờ giữa các dải raster.
    static func finish(autoCut: Bool) -> [UInt8] {
        return autoCut ? [27, 100, 1, 29, 86, 66, 0] : [27, 100, 1]
    }

    /// pixels: bộ đệm RGBA (4 byte/điểm, hàng liên tiếp từ trên xuống) chứa toàn bộ
    /// hoặc một phần hóa đơn; mã hóa các hàng firstRow..<firstRow+rowCount.
    static func encodeRows(pixels: [UInt8], width: Int, firstRow: Int, rowCount: Int) throws -> [UInt8] {
        let height = rowCount
        guard width > 0, width % 8 == 0, firstRow >= 0, height > 0, height <= 65535,
              pixels.count >= (firstRow + height) * width * 4 else {
            throw RasterError.invalidDimensions
        }
        let bytesPerRow = width / 8
        var data = [UInt8](repeating: 0, count: 8 + bytesPerRow * height)
        data[0] = 29; data[1] = 118; data[2] = 48; data[3] = 0
        data[4] = UInt8(bytesPerRow & 0xFF); data[5] = UInt8((bytesPerRow >> 8) & 0xFF)
        data[6] = UInt8(height & 0xFF); data[7] = UInt8((height >> 8) & 0xFF)
        for y in 0..<height {
            for x in 0..<width {
                let i = ((firstRow + y) * width + x) * 4
                let luminance = (299 * Int(pixels[i]) + 587 * Int(pixels[i + 1]) + 114 * Int(pixels[i + 2])) / 1000
                if luminance < 180 {
                    data[8 + y * bytesPerRow + x / 8] |= UInt8(128 >> (x % 8))
                }
            }
        }
        return data
    }
}
