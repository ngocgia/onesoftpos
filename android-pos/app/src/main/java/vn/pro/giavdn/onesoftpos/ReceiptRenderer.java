package vn.pro.giavdn.onesoftpos;

import android.app.Activity;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;

/** Renders the frozen on-screen receipt, preserving its columns, styles and QR. */
final class ReceiptRenderer {
    interface Result { void complete(byte[] raster, String error); }
    private final Activity activity;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private WebView renderer;
    private Runnable timeout;
    private Result pending;

    ReceiptRenderer(Activity activity) { this.activity = activity; }
    boolean isBusy() { return pending != null; }

    void render(String html, int targetWidth, Result result) {
        if (isBusy()) { result.complete(null, "Đang chuẩn bị một phiếu in khác"); return; }
        pending = result;
        if (html.length() > 2000000) { finish(null, "Hóa đơn quá lớn để dựng bản in"); return; }
        renderer = new WebView(activity);
        renderer.setBackgroundColor(Color.WHITE);
        renderer.setLayerType(View.LAYER_TYPE_SOFTWARE, null);
        renderer.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);
        renderer.getSettings().setJavaScriptEnabled(true);
        renderer.getSettings().setAllowFileAccess(false);
        renderer.getSettings().setAllowContentAccess(false);
        renderer.getSettings().setUseWideViewPort(true);
        renderer.getSettings().setLoadWithOverviewMode(true);
        renderer.getSettings().setTextZoom(100);
        renderer.setTranslationX(-30000);
        ViewGroup root = activity.findViewById(android.R.id.content);
        root.addView(renderer, 0, new FrameLayout.LayoutParams(targetWidth, targetWidth));
        renderer.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return true; }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                android.net.Uri url = request.getUrl();
                if ("data".equals(url.getScheme())) return null;
                if ("https".equals(url.getScheme()) && "img.vietqr.io".equals(url.getHost())) return null;
                return new WebResourceResponse("text/plain", "UTF-8", new ByteArrayInputStream(new byte[0]));
            }
            @Override public void onPageFinished(WebView view, String url) {
                handler.postDelayed(() -> { if (renderer == view) measure(targetWidth); }, 100);
            }
        });
        timeout = () -> finish(null, "Dựng hóa đơn quá thời gian. Kiểm tra kết nối tải QR rồi thử lại.");
        handler.postDelayed(timeout, 20000);
        renderer.loadDataWithBaseURL("https://onesoft.one/", html, "text/html", "UTF-8", null);
    }

    private void measure(int width) {
        if (renderer == null || pending == null) return;
        WebView current = renderer;
        current.evaluateJavascript("(function(){var imgs=Array.from(document.images).filter(function(i){return i.getBoundingClientRect().width>0});return {ok:imgs.every(function(i){return i.complete&&i.naturalWidth>0}),width:document.body.getBoundingClientRect().width,height:Math.ceil(document.body.getBoundingClientRect().height)}})()", value -> {
            if (renderer != current || pending == null) return;
            try {
                org.json.JSONObject size = new org.json.JSONObject(value);
                if (!size.optBoolean("ok")) { finish(null, "Không tải được QR cho bản in. Vui lòng thử lại."); return; }
                double cssWidth = size.getDouble("width");
                double cssHeight = size.getDouble("height");
                int height = (int) Math.ceil(cssHeight * width / cssWidth);
                if (cssWidth <= 0 || height <= 0 || height > 24000) { finish(null, "Kích thước hóa đơn không hợp lệ hoặc phiếu quá dài"); return; }
                renderer.getLayoutParams().height = height;
                renderer.measure(View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY));
                renderer.layout(0, 0, width, height);
                handler.postDelayed(() -> { if (renderer == current) capture(width, height); }, 100);
            } catch (Exception error) { finish(null, "Không đo được bố cục hóa đơn"); }
        });
    }

    private void capture(int width, int height) {
        if (renderer == null || pending == null) return;
        Bitmap strip = null;
        try {
            // Only one short bitmap is allocated, even for a long receipt.
            ByteArrayOutputStream raster = new ByteArrayOutputStream();
            strip = Bitmap.createBitmap(width, 128, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(strip);
            int[] pixels = new int[width * 128];
            for (int top = 0; top < height; top += 128) {
                int rows = Math.min(128, height - top);
                canvas.drawColor(Color.WHITE);
                canvas.save(); canvas.translate(0, -top); renderer.draw(canvas); canvas.restore();
                strip.getPixels(pixels, 0, width, 0, 0, width, rows);
                raster.write(EscPosRaster.encode(pixels, width, rows));
            }
            finish(raster.toByteArray(), null);
        } catch (Exception error) { finish(null, "Không dựng được ảnh hóa đơn: " + error.getMessage()); }
        finally { if (strip != null) strip.recycle(); }
    }

    private void finish(byte[] raster, String error) {
        Result callback = pending;
        pending = null;
        if (timeout != null) handler.removeCallbacks(timeout);
        timeout = null;
        if (renderer != null) {
            ViewGroup parent = (ViewGroup) renderer.getParent();
            if (parent != null) parent.removeView(renderer);
            renderer.destroy(); renderer = null;
        }
        if (callback != null) callback.complete(raster, error);
    }
    void close() { finish(null, "Đã dừng chuẩn bị phiếu in"); }
}
