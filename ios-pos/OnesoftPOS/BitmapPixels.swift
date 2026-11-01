import Foundation
import UIKit

/// Chuyển CGImage thành bộ đệm RGBA đúng kích thước yêu cầu (hàng trên trước).
enum BitmapPixels {
    /// Vẽ ảnh vào ngữ cảnh bitmap width x height (điểm ảnh), nền trắng,
    /// trả về bộ đệm RGBA 8 bit có hàng đầu tiên là hàng trên cùng.
    static func rgba(from image: CGImage, width: Int, height: Int) -> [UInt8]? {
        guard width > 0, height > 0 else { return nil }
        var data = [UInt8](repeating: 255, count: width * height * 4)
        let ok = data.withUnsafeMutableBytes { pointer -> Bool in
            guard let base = pointer.baseAddress,
                  let context = CGContext(
                    data: base,
                    width: width,
                    height: height,
                    bitsPerComponent: 8,
                    bytesPerRow: width * 4,
                    space: CGColorSpaceCreateDeviceRGB(),
                    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
                  ) else { return false }
            context.interpolationQuality = .none
            context.setFillColor(UIColor.white.cgColor)
            context.fill(CGRect(x: 0, y: 0, width: CGFloat(width), height: CGFloat(height)))
            // Lật hệ tọa độ để hàng đầu tiên của bộ đệm là hàng trên cùng của ảnh.
            context.translateBy(x: 0, y: CGFloat(height))
            context.scaleBy(x: 1, y: -1)
            context.draw(image, in: CGRect(x: 0, y: 0, width: CGFloat(width), height: CGFloat(height)))
            return true
        }
        return ok ? data : nil
    }
}
