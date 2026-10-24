package vn.pro.giavdn.onesoftpos;

/** A numeric IPv4 address only: never interpret URLs or resolve untrusted hostnames. */
final class PrinterNetworkAddress {
    static String parse(String value) {
        if (value == null || value.trim().isEmpty()) throw new IllegalArgumentException("App chưa nhận được IP máy in. Hãy mở Cài đặt máy in, nhập IP và bấm Lưu. Nếu đã lưu, cần cập nhật website hoặc APK mới.");
        String[] parts = value.trim().split("\\.", -1);
        if (parts.length != 4) throw new IllegalArgumentException("IP nhận được không hợp lệ: " + value.trim().substring(0, Math.min(value.trim().length(), 60)) + ". Nhập dạng 192.168.1.27, không kèm http:// hoặc cổng");
        StringBuilder result = new StringBuilder();
        for (String part : parts) {
            if (!part.matches("[0-9]{1,3}")) throw new IllegalArgumentException("Địa chỉ IP máy in không hợp lệ");
            int number = Integer.parseInt(part);
            if (number > 255) throw new IllegalArgumentException("Địa chỉ IP máy in không hợp lệ");
            if (result.length() > 0) result.append('.');
            result.append(number);
        }
        int first = Integer.parseInt(parts[0]);
        if (first == 0 || first >= 224 || "255".equals(parts[3])) throw new IllegalArgumentException("Cần IP của máy in, không dùng địa chỉ broadcast/multicast");
        return result.toString();
    }
}
