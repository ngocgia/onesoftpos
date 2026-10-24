package vn.pro.giavdn.onesoftpos;

import java.io.Closeable;
import java.io.IOException;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

/** Bound connection and transmission separately; never retry a possibly printed job. */
final class BluetoothPrintSession {
    interface Action { void run() throws IOException; }
    static void run(Closeable socket, Action connect, Action transmit, ScheduledExecutorService timer,
                    long connectMillis, long transmitMillis) throws IOException {
        try (Closeable connection = socket) {
            ScheduledFuture<?> connecting = timer.schedule(() -> closeQuietly(connection), connectMillis, TimeUnit.MILLISECONDS);
            try { connect.run(); } finally { connecting.cancel(false); }
            ScheduledFuture<?> sending = timer.schedule(() -> closeQuietly(connection), transmitMillis, TimeUnit.MILLISECONDS);
            try { transmit.run(); } finally { sending.cancel(false); }
        }
    }
    private static void closeQuietly(Closeable socket) {
        try { socket.close(); } catch (IOException ignored) {}
    }
}
