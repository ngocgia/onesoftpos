import Foundation

/// Chỉ nhận địa chỉ IPv4 dạng số: không bao giờ diễn giải URL hay phân giải
/// tên máy không tin cậy. Port 1:1 từ PrinterNetworkAddress.java.
enum PrinterNetworkAddress {
    struct ValidationError: Error, CustomStringConvertible {
        let message: String
        var description: String { message }
    }

    static func parse(_ value: String?) throws -> String {
        let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if trimmed.isEmpty {
            throw ValidationError(
                message: "App chưa nhận được IP máy in. Hãy mở Cài đặt máy in, nhập IP và bấm Lưu. Nếu đã lưu, cần cập nhật website hoặc app mới.")
        }
        let parts = trimmed.split(separator: ".", omittingEmptySubsequences: false).map(String.init)
        if parts.count != 4 {
            let preview = String(trimmed.prefix(60))
            throw ValidationError(
                message: "IP nhận được không hợp lệ: \(preview). Nhập dạng 192.168.1.27, không kèm http:// hoặc cổng")
        }
        var numbers: [Int] = []
        for part in parts {
            guard part.count <= 3, part.allSatisfy({ $0.isNumber }), let number = Int(part), number <= 255 else {
                throw ValidationError(message: "Địa chỉ IP máy in không hợp lệ")
            }
            numbers.append(number)
        }
        if numbers[0] == 0 || numbers[0] >= 224 || parts[3] == "255" {
            throw ValidationError(message: "Cần IP của máy in, không dùng địa chỉ broadcast/multicast")
        }
        return numbers.map(String.init).joined(separator: ".")
    }
}
