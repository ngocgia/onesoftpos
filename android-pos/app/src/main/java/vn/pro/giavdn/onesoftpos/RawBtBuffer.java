package vn.pro.giavdn.onesoftpos;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;

/** Build a complete RawBT job before opening any external print activity. */
final class RawBtBuffer extends OutputStream {
    static final int MAX_BYTES = 180000;
    private final ByteArrayOutputStream data = new ByteArrayOutputStream();
    private void reserve(int length) throws IOException {
        if (length > MAX_BYTES - data.size()) throw new IOException("Phiếu vượt giới hạn RawBT (180 KB dữ liệu in). Chưa gửi phiếu; hãy dùng LAN hoặc USB trực tiếp cho phiếu dài.");
    }
    @Override public void write(int value) throws IOException { reserve(1); data.write(value); }
    @Override public void write(byte[] value, int offset, int length) throws IOException {
        reserve(length);
        data.write(value, offset, length);
    }
    byte[] toByteArray() { return data.toByteArray(); }
}
