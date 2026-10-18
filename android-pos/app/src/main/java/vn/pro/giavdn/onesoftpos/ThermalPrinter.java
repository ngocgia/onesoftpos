package vn.pro.giavdn.onesoftpos;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.PendingIntent;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothSocket;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.hardware.usb.*;
import android.os.Build;
import android.text.Layout;
import android.text.StaticLayout;
import android.text.TextPaint;
import android.widget.Toast;
import java.io.IOException;
import java.io.OutputStream;
import java.io.InputStream;
import java.net.URL;
import javax.net.ssl.HttpsURLConnection;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;

/** Sends Unicode receipts as monochrome raster, independent of printer code pages. */
final class ThermalPrinter {
    static final int BLUETOOTH_PERMISSION = 2031;
    private final Activity activity;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final ScheduledExecutorService timer = Executors.newSingleThreadScheduledExecutor();
    private final String usbAction;
    private boolean busy;
    private String text;
    private String qrUrl;
    private String footer;
    private int width;
    private UsbDevice waitingDevice;
    private boolean receiverRegistered;
    private volatile boolean closed;
    private volatile BluetoothSocket activeSocket;

    ThermalPrinter(Activity activity) {
        this.activity = activity;
        usbAction = activity.getPackageName() + ".USB_PRINT_PERMISSION";
    }

    void print(String receipt, String paper, String connection, String receiptQrUrl, String receiptFooter) {
        if (closed) return;
        if (busy) { message("Đang xử lý một phiếu in. Vui lòng chờ."); return; }
        if (receipt == null || receipt.trim().isEmpty()) { message("Chưa có dữ liệu hóa đơn"); return; }
        text = receipt;
        qrUrl = receiptQrUrl;
        footer = receiptFooter;
        // K80/K85 use a conservative 72mm raster until the exact printhead width is known.
        width = "58mm".equals(paper) ? 384 : 576;
        busy = true;
        if ("bluetooth".equals(connection)) chooseBluetooth();
        else chooseUsb();
    }

    private void message(String message) {
        activity.runOnUiThread(() -> {
            if (!closed && !activity.isFinishing() && !activity.isDestroyed()) Toast.makeText(activity, message, Toast.LENGTH_LONG).show();
        });
    }

    private void stop(String message) { busy = false; message(message); }

    private void chooseBluetooth() {
        if (Build.VERSION.SDK_INT >= 31 && activity.checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
            activity.requestPermissions(new String[]{Manifest.permission.BLUETOOTH_CONNECT}, BLUETOOTH_PERMISSION);
            return;
        }
        try {
            BluetoothManager manager = (BluetoothManager) activity.getSystemService(Context.BLUETOOTH_SERVICE);
            BluetoothAdapter adapter = manager == null ? null : manager.getAdapter();
            if (adapter == null || !adapter.isEnabled()) { stop("Hãy bật Bluetooth và ghép đôi máy in trong Cài đặt Android"); return; }
            List<BluetoothDevice> devices = new ArrayList<>(adapter.getBondedDevices());
            if (devices.isEmpty()) { stop("Chưa có thiết bị ghép đôi. Hãy ghép đôi máy in trong Cài đặt Bluetooth."); return; }
            String[] labels = new String[devices.size()];
            for (int i = 0; i < devices.size(); i++) labels[i] = devices.get(i).getName() + "\n" + devices.get(i).getAddress();
            new AlertDialog.Builder(activity).setTitle("Chọn máy in Bluetooth (SPP)")
                    .setItems(labels, (dialog, index) -> sendBluetooth(devices.get(index)))
                    .setOnCancelListener(dialog -> busy = false).show();
        } catch (Exception error) { stop("Không mở được Bluetooth: " + error.getMessage()); }
    }

    void onBluetoothPermission(boolean granted) {
        if (granted && busy) chooseBluetooth();
        else stop("Cần quyền Thiết bị ở gần để in Bluetooth");
    }

    private void sendBluetooth(BluetoothDevice device) {
        message("Đang kết nối máy in...");
        worker.execute(() -> {
            try (BluetoothSocket socket = device.createRfcommSocketToServiceRecord(UUID.fromString("00001101-0000-1000-8000-00805F9B34FB"))) {
                activeSocket = socket;
                if (closed) return;
                ScheduledFuture<?> timeout = timer.schedule(() -> { try { socket.close(); } catch (IOException ignored) {} }, 90, TimeUnit.SECONDS);
                try {
                    socket.connect();
                    sendRaster(socket.getOutputStream());
                    message("Đã gửi dữ liệu in. Vui lòng kiểm tra giấy in.");
                } finally { timeout.cancel(false); }
            } catch (Exception error) {
                message("In Bluetooth thất bại: " + error.getMessage() + ". Kiểm tra phiếu trước khi in lại để tránh trùng.");
            } finally { activeSocket = null; activity.runOnUiThread(() -> busy = false); }
        });
    }

    private boolean printable(UsbDevice device) {
        for (int i = 0; i < device.getInterfaceCount(); i++) {
            UsbInterface iface = device.getInterface(i);
            // Raw printer interfaces only. USB serial devices need their own driver.
            if (iface.getInterfaceClass() != UsbConstants.USB_CLASS_PRINTER && iface.getInterfaceClass() != UsbConstants.USB_CLASS_VENDOR_SPEC) continue;
            for (int j = 0; j < iface.getEndpointCount(); j++) {
                UsbEndpoint endpoint = iface.getEndpoint(j);
                if (endpoint.getType() == UsbConstants.USB_ENDPOINT_XFER_BULK && endpoint.getDirection() == UsbConstants.USB_DIR_OUT) return true;
            }
        }
        return false;
    }

    private void chooseUsb() {
        UsbManager manager = (UsbManager) activity.getSystemService(Context.USB_SERVICE);
        if (manager == null) { stop("Thiết bị không hỗ trợ in USB"); return; }
        List<UsbDevice> devices = new ArrayList<>();
        for (UsbDevice device : manager.getDeviceList().values()) if (printable(device)) devices.add(device);
        if (devices.isEmpty()) { stop("Không tìm thấy máy in USB ESC/POS. Kiểm tra cáp OTG, nguồn và chế độ USB của máy in."); return; }
        String[] labels = new String[devices.size()];
        for (int i = 0; i < devices.size(); i++) labels[i] = (devices.get(i).getProductName() == null ? "Máy in USB" : devices.get(i).getProductName()) + " (" + devices.get(i).getDeviceName() + ")";
        new AlertDialog.Builder(activity).setTitle("Chọn máy in USB")
                .setItems(labels, (dialog, index) -> {
                    waitingDevice = devices.get(index);
                    if (manager.hasPermission(waitingDevice)) {
                        UsbDevice device = waitingDevice;
                        waitingDevice = null;
                        sendUsb(device);
                        return;
                    }
                    if (!receiverRegistered) {
                        if (Build.VERSION.SDK_INT >= 33) activity.registerReceiver(usbReceiver, new IntentFilter(usbAction), Context.RECEIVER_NOT_EXPORTED);
                        else activity.registerReceiver(usbReceiver, new IntentFilter(usbAction));
                        receiverRegistered = true;
                    }
                    PendingIntent permission = PendingIntent.getBroadcast(activity, 0,
                            new Intent(usbAction).setPackage(activity.getPackageName()), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
                    manager.requestPermission(waitingDevice, permission);
                }).setOnCancelListener(dialog -> busy = false).show();
    }

    private final BroadcastReceiver usbReceiver = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) {
            if (!usbAction.equals(intent.getAction()) || !busy || waitingDevice == null) return;
            UsbManager manager = (UsbManager) activity.getSystemService(Context.USB_SERVICE);
            UsbDevice device = waitingDevice;
            waitingDevice = null;
            if (manager.hasPermission(device)) sendUsb(device);
            else stop("Chưa được cấp quyền truy cập máy in USB");
        }
    };

    private void sendUsb(UsbDevice device) {
        worker.execute(() -> {
            UsbManager manager = (UsbManager) activity.getSystemService(Context.USB_SERVICE);
            UsbDeviceConnection connection = null;
            UsbInterface selected = null;
            try {
                if (closed) return;
                // Permission may be revoked or the cable detached after the device picker.
                connection = manager.openDevice(device);
                if (connection == null) throw new IOException("Không mở được máy in USB");
                UsbEndpoint output = null;
                for (int i = 0; i < device.getInterfaceCount() && output == null; i++) {
                    UsbInterface iface = device.getInterface(i);
                    if (iface.getInterfaceClass() != UsbConstants.USB_CLASS_PRINTER && iface.getInterfaceClass() != UsbConstants.USB_CLASS_VENDOR_SPEC) continue;
                    for (int j = 0; j < iface.getEndpointCount(); j++) {
                        UsbEndpoint endpoint = iface.getEndpoint(j);
                        if (endpoint.getDirection() == UsbConstants.USB_DIR_OUT && endpoint.getType() == UsbConstants.USB_ENDPOINT_XFER_BULK) {
                            selected = iface; output = endpoint; break;
                        }
                    }
                }
                if (selected == null || !connection.claimInterface(selected, true)) throw new IOException("Không chiếm được cổng USB");
                final UsbEndpoint endpoint = output;
                final UsbDeviceConnection outputConnection = connection;
                sendRaster(new OutputStream() {
                    @Override public void write(int value) throws IOException { write(new byte[]{(byte) value}, 0, 1); }
                    @Override public void write(byte[] bytes, int offset, int length) throws IOException {
                        while (length > 0) {
                            if (closed || Thread.currentThread().isInterrupted()) throw new IOException("Đã dừng in");
                            int written = outputConnection.bulkTransfer(endpoint, bytes, offset, Math.min(length, 1024), 10000);
                            if (written <= 0) throw new IOException("Mất kết nối hoặc máy in không nhận dữ liệu");
                            offset += written; length -= written;
                        }
                    }
                });
                message("Đã gửi dữ liệu in. Vui lòng kiểm tra giấy in.");
            } catch (Exception error) { message("In USB thất bại: " + error.getMessage() + ". Kiểm tra phiếu trước khi in lại để tránh trùng."); }
            finally {
                if (connection != null) { if (selected != null) connection.releaseInterface(selected); connection.close(); }
                activity.runOnUiThread(() -> busy = false);
            }
        });
    }

    private void sendRaster(OutputStream output) throws IOException {
        Bitmap qr = null;
        try {
            // Load before sending any paper, so a failed QR download cannot print a partial bill.
            if (qrUrl != null && !qrUrl.isEmpty()) {
                URL url = new URL(qrUrl);
                if (!"https".equals(url.getProtocol()) || !"img.vietqr.io".equals(url.getHost()) || (url.getPort() != -1 && url.getPort() != 443)) throw new IOException("Địa chỉ QR không hợp lệ");
                HttpsURLConnection connection = (HttpsURLConnection) url.openConnection();
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(15000);
                connection.setInstanceFollowRedirects(false);
                try {
                    if (connection.getResponseCode() != 200) throw new IOException("Không tải được QR thanh toán");
                    try (InputStream input = connection.getInputStream()) { qr = BitmapFactory.decodeStream(input); }
                    if (qr == null || qr.getWidth() < 100 || qr.getHeight() < 100) throw new IOException("Ảnh QR không hợp lệ");
                } finally { connection.disconnect(); }
            }
            output.write(new byte[]{27, 64, 27, 97, 0});
            sendText(output, text);
            if (qr != null) {
                int size = 256; // 32mm at 203dpi, including the QR quiet zone.
                Bitmap scaled = Bitmap.createScaledBitmap(qr, size, size, false);
                Bitmap strip = Bitmap.createBitmap(width, 64, Bitmap.Config.ARGB_8888);
                try {
                    Canvas canvas = new Canvas(strip);
                    int[] pixels = new int[width * 64];
                    for (int top = 0; top < size; top += 64) {
                        int rows = Math.min(64, size - top);
                        canvas.drawColor(Color.WHITE);
                        canvas.drawBitmap(scaled, (width - size) / 2f, -top, null);
                        strip.getPixels(pixels, 0, width, 0, 0, width, rows);
                        output.write(EscPosRaster.encode(pixels, width, rows));
                        output.flush();
                        try { Thread.sleep(180); } catch (InterruptedException error) { Thread.currentThread().interrupt(); throw new IOException("Đã dừng in", error); }
                    }
                } finally { strip.recycle(); if (scaled != qr) scaled.recycle(); }
                if (footer != null && !footer.isEmpty()) sendText(output, footer);
            }
            output.write(new byte[]{27, 100, 4});
            output.flush();
        } finally { if (qr != null) qr.recycle(); }
    }

    private void sendText(OutputStream output, String text) throws IOException {
        TextPaint paint = new TextPaint(android.graphics.Paint.ANTI_ALIAS_FLAG);
        paint.setColor(Color.BLACK);
        paint.setTypeface(android.graphics.Typeface.create("sans-serif", android.graphics.Typeface.NORMAL));
        paint.setTextSize(width == 384 ? 22 : 26);
        StaticLayout layout = StaticLayout.Builder.obtain(text, 0, text.length(), paint, width - 16)
                .setAlignment(Layout.Alignment.ALIGN_NORMAL).setIncludePad(true).setLineSpacing(3, 1).build();
        // Render in strips so long bills do not allocate a full-height bitmap or overflow printer buffers.
        final int stripHeight = 64;
        Bitmap strip = Bitmap.createBitmap(width, stripHeight, Bitmap.Config.ARGB_8888);
        try {
            Canvas canvas = new Canvas(strip);
            int[] pixels = new int[width * stripHeight];
            for (int top = 0; top < layout.getHeight(); top += stripHeight) {
                int rows = Math.min(stripHeight, layout.getHeight() - top);
                canvas.drawColor(Color.WHITE);
                canvas.save(); canvas.translate(8, -top); layout.draw(canvas); canvas.restore();
                strip.getPixels(pixels, 0, width, 0, 0, width, rows);
                byte[] command = EscPosRaster.encode(pixels, width, rows);
                output.write(command);
                output.flush();
                // 64 dots = 8mm at 203dpi. Allow slower 50mm/s printers to drain their buffer.
                try { Thread.sleep(180); } catch (InterruptedException error) { Thread.currentThread().interrupt(); throw new IOException("Đã dừng in", error); }
            }
        } finally { strip.recycle(); }
    }

    void close() {
        closed = true;
        if (receiverRegistered) activity.unregisterReceiver(usbReceiver);
        BluetoothSocket socket = activeSocket;
        if (socket != null) try { socket.close(); } catch (IOException ignored) {}
        worker.shutdownNow();
        timer.shutdownNow();
    }
}
