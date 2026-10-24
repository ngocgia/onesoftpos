package vn.pro.giavdn.onesoftpos;

import java.io.Closeable;
import java.io.IOException;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ScheduledThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

public final class BluetoothPrintSessionTest {
    static final class FakeSocket implements Closeable {
        final CountDownLatch closed = new CountDownLatch(1);
        final AtomicInteger closeCount = new AtomicInteger();
        @Override public void close() { closeCount.incrementAndGet(); closed.countDown(); }
        void blockUntilClosed() throws IOException {
            try {
                if (!closed.await(2, TimeUnit.SECONDS)) throw new AssertionError("Timeout did not close blocked socket");
            } catch (InterruptedException error) { Thread.currentThread().interrupt(); }
            throw new IOException("Socket closed");
        }
    }
    public static void main(String[] args) throws Exception {
        ScheduledThreadPoolExecutor timer = new ScheduledThreadPoolExecutor(1);
        timer.setRemoveOnCancelPolicy(true);
        try {
            AtomicInteger connects = new AtomicInteger(), sends = new AtomicInteger();
            FakeSocket success = new FakeSocket();
            BluetoothPrintSession.run(success, () -> connects.incrementAndGet(), () -> sends.incrementAndGet(), timer, 500, 500);
            if (connects.get() != 1 || sends.get() != 1 || success.closeCount.get() != 1) throw new AssertionError("Normal job lifecycle");
            if (!timer.getQueue().isEmpty()) throw new AssertionError("Successful job left timeouts queued");

            FakeSocket blockedConnect = new FakeSocket();
            sends.set(0);
            try { BluetoothPrintSession.run(blockedConnect, blockedConnect::blockUntilClosed, () -> sends.incrementAndGet(), timer, 25, 500); throw new AssertionError("Connect timeout ignored"); }
            catch (IOException expected) {}
            if (sends.get() != 0) throw new AssertionError("Sent bytes after failed connection");

            FakeSocket blockedSend = new FakeSocket();
            sends.set(0);
            try {
                BluetoothPrintSession.run(blockedSend, () -> {}, () -> { sends.incrementAndGet(); blockedSend.blockUntilClosed(); }, timer, 500, 25);
                throw new AssertionError("Send timeout ignored");
            } catch (IOException expected) {}
            if (sends.get() != 1) throw new AssertionError("Partially sent Bluetooth job retried");

            FakeSocket failedSend = new FakeSocket();
            sends.set(0);
            try {
                BluetoothPrintSession.run(failedSend, () -> {}, () -> { sends.incrementAndGet(); throw new IOException("Disconnected after first bytes"); }, timer, 500, 500);
                throw new AssertionError("Disconnect ignored");
            } catch (IOException expected) {}
            if (sends.get() != 1 || failedSend.closeCount.get() != 1 || !timer.getQueue().isEmpty()) throw new AssertionError("Disconnect cleanup/no-retry");
            System.out.println("Bluetooth session tests passed: connect/send timeouts close blocked sockets, no send after connect failure, no retry after partial send, timer cleanup");
        } finally { timer.shutdownNow(); }
    }
}
