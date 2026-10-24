package vn.pro.giavdn.onesoftpos;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Arrays;
import java.util.concurrent.atomic.AtomicInteger;

public final class PrintTransportTest {
    public static void main(String[] args) throws Exception {
        byte[] original = new byte[15000];
        for (int i = 0; i < original.length; i++) original[i] = (byte) i;
        ByteArrayOutputStream received = new ByteArrayOutputStream();
        AtomicInteger transfers = new AtomicInteger();
        UsbBulkWriter.write(original, 10, original.length - 20, 1000, (data, offset, length, timeout) -> {
            if (length > 1024 || timeout <= 0 || timeout > 1000) throw new AssertionError("USB transfer bounds");
            transfers.incrementAndGet();
            int shortWrite = Math.min(length, 73);
            received.write(data, offset, shortWrite);
            return shortWrite;
        }, () -> false, () -> 0);
        if (!Arrays.equals(received.toByteArray(), Arrays.copyOfRange(original, 10, original.length - 10))) throw new AssertionError("Short USB transfers lost or duplicated bytes");
        if (transfers.get() < 2) throw new AssertionError("Partial transfer path not exercised");
        for (int badCount : new int[]{0, -1, 1025}) {
            transfers.set(0);
            try {
                UsbBulkWriter.write(original, 0, original.length, 1000, (data, offset, length, timeout) -> { transfers.incrementAndGet(); return badCount; }, () -> false, () -> 0);
                throw new AssertionError("Invalid transfer result accepted");
            } catch (IOException expected) {
                if (transfers.get() != 1) throw new AssertionError("Failed USB job was retried");
            }
        }
        UsbBulkWriter.Transfer mustNotWrite = (data, offset, length, timeout) -> { throw new AssertionError("Cancelled/timed-out job sent bytes"); };
        try { UsbBulkWriter.write(original, 0, 1, 1000, mustNotWrite, () -> true, () -> 0); throw new AssertionError("Cancellation ignored"); } catch (IOException expected) {}
        try { UsbBulkWriter.write(original, 0, 1, 1000, mustNotWrite, () -> false, () -> 1001); throw new AssertionError("Deadline ignored"); } catch (IOException expected) {}

        RawBtBuffer buffer = new RawBtBuffer();
        byte[] boundary = new byte[RawBtBuffer.MAX_BYTES];
        Arrays.fill(boundary, (byte) 0xa5);
        buffer.write(boundary);
        try { buffer.write(1); throw new AssertionError("RawBT exceeded Binder-safe limit"); } catch (IOException expected) {}
        if (!Arrays.equals(boundary, buffer.toByteArray())) throw new AssertionError("RawBT payload modified on rejection");
        RawBtBuffer tooLarge = new RawBtBuffer();
        try { tooLarge.write(new byte[RawBtBuffer.MAX_BYTES + 1]); throw new AssertionError("Oversized block accepted"); } catch (IOException expected) {}
        if (tooLarge.toByteArray().length != 0) throw new AssertionError("Oversized block partially accepted");
        System.out.println("USB/RawBT tests passed: exact bytes, short transfers, errors without retry, cancellation/deadline, complete bounded payload");
    }
}
