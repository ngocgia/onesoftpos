package vn.pro.giavdn.onesoftpos;

import java.io.IOException;
import java.util.function.BooleanSupplier;
import java.util.function.LongSupplier;

/** Handles short USB transfers without resending bytes already accepted. */
final class UsbBulkWriter {
    interface Transfer { int send(byte[] data, int offset, int length, int timeoutMillis) throws IOException; }

    static void write(byte[] data, int offset, int length, long deadline, Transfer transfer,
                      BooleanSupplier cancelled, LongSupplier clock) throws IOException {
        while (length > 0) {
            if (cancelled.getAsBoolean()) throw new IOException("Đã dừng in USB");
            long remaining = deadline - clock.getAsLong();
            if (remaining <= 0) throw new IOException("In USB quá thời gian chờ");
            int requested = Math.min(length, 1024);
            int written = transfer.send(data, offset, requested, (int) Math.min(10000, remaining));
            if (written <= 0 || written > requested) throw new IOException("Mất kết nối hoặc máy in USB không nhận dữ liệu");
            offset += written;
            length -= written;
        }
    }
}
