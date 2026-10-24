package vn.pro.giavdn.onesoftpos;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

public final class MainActivity extends Activity {
    private static final String HOST = "onesoft.one";
    private static final String POS_URL = "https://" + HOST + "/?mode=pos";
    private static final String CLEAR_ADMIN_SESSION_SCRIPT = "(function(){"
            + "localStorage.removeItem('thichgapos_token');"
            + "localStorage.removeItem('thichgapos_store_id');"
            + "sessionStorage.clear();"
            + "})()";
    private static final String APP_BRIDGE_SCRIPT = "(function(){"
            + "window.onesoftAudio={beep:function(v){OnesoftAudioBridge.beep(v)},speak:function(t,v){OnesoftAudioBridge.speak(String(t),v)}};"
            + "window.onesoftNativePrint=true;"
            + "window.onesoftNativeRawBt=true;"
            + "window.onesoftNativeLanPrint=true;"
            + "window.onesoftNativeReceiptQr=true;"
            + "window.print=function(){var paper=(window.appState&&window.appState.storeSettings&&window.appState.storeSettings.receipt_paper_size)||'80mm';"
            + "var connection=(window.appState&&window.appState.storeSettings&&window.appState.storeSettings.receipt_connection_type)||'browser';"
            + "var cut=!(window.appState&&window.appState.storeSettings&&window.appState.storeSettings.receipt_auto_cut_paper===false);"
            + "var ip=(window.appState&&window.appState.storeSettings&&window.appState.storeSettings.receipt_ip_address)||'';"
            + "window.location.href='tgpos://print?paper='+encodeURIComponent(paper)+'&connection='+encodeURIComponent(connection)+'&cut='+(cut?'1':'0')+'&ip='+encodeURIComponent(ip)}"
            + "})()";

    private WebView webView;
    private ThermalPrinter thermalPrinter;
    private NativeSpeaker nativeSpeaker;
    private ProgressBar progress;
    private LinearLayout errorView;
    private boolean loadFailed;
    private boolean pageLoaded;

    private int insetTopDp = 0;
    private int insetBottomDp = 0;
    private int insetLeftDp = 0;
    private int insetRightDp = 0;

    private ValueCallback<Uri[]> fileUploadCallback;
    private static final int FILE_CHOOSER_REQUEST_CODE = 1001;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        thermalPrinter = new ThermalPrinter(this);
        nativeSpeaker = new NativeSpeaker(this);
        setVolumeControlStream(android.media.AudioManager.STREAM_MUSIC);
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::handleBack);
        }

        FrameLayout frame = new FrameLayout(this);
        frame.setBackgroundColor(Color.WHITE);
        setContentView(frame);

        // Kích hoạt tràn viền an toàn sau khi đã setContentView
        setupEdgeToEdge();

        webView = new WebView(this);
        webView.addJavascriptInterface(new AudioBridge(), "OnesoftAudioBridge");
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        frame.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        // Lắng nghe Window Insets: KHÔNG set padding cho FrameLayout để WebView tràn sát mép
        frame.setOnApplyWindowInsetsListener((view, insets) -> {
            try {
                int topPx = insets.getSystemWindowInsetTop();
                int bottomPx = insets.getSystemWindowInsetBottom();
                int leftPx = insets.getSystemWindowInsetLeft();
                int rightPx = insets.getSystemWindowInsetRight();

                float density = getResources().getDisplayMetrics().density;
                if (density > 0) {
                    insetTopDp = Math.round(topPx / density);
                    insetBottomDp = Math.round(bottomPx / density);
                    insetLeftDp = Math.round(leftPx / density);
                    insetRightDp = Math.round(rightPx / density);
                }

                if (pageLoaded) {
                    applyInsetsToWebView();
                }
            } catch (Throwable ignored) {}
            return insets;
        });

        progress = new ProgressBar(this);
        FrameLayout.LayoutParams progressParams = new FrameLayout.LayoutParams(-2, -2, Gravity.CENTER);
        frame.addView(progress, progressParams);

        errorView = new LinearLayout(this);
        errorView.setOrientation(LinearLayout.VERTICAL);
        errorView.setGravity(Gravity.CENTER);
        errorView.setPadding(32, 32, 32, 32);
        TextView message = new TextView(this);
        message.setText("Không tải được Onesoft POS. Hãy kiểm tra kết nối mạng.");
        message.setTextColor(Color.DKGRAY);
        message.setTextSize(17);
        message.setGravity(Gravity.CENTER);
        errorView.addView(message);
        Button retry = new Button(this);
        retry.setText("Thử lại");
        retry.setOnClickListener(view -> webView.loadUrl(POS_URL));
        errorView.addView(retry);
        errorView.setVisibility(View.GONE);
        frame.addView(errorView, new FrameLayout.LayoutParams(-1, -1));

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(false);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);

        webView.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view, int newProgress) {
                if (!loadFailed && newProgress < 100) progress.setVisibility(View.VISIBLE);
            }
            @Override public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback,
                    FileChooserParams fileChooserParams) {
                if (fileUploadCallback != null) {
                    fileUploadCallback.onReceiveValue(null);
                    fileUploadCallback = null;
                }
                fileUploadCallback = filePathCallback;

                Intent intent = null;
                if (fileChooserParams != null) {
                    try {
                        intent = fileChooserParams.createIntent();
                    } catch (Exception ignored) {}
                }
                if (intent == null) {
                    intent = new Intent(Intent.ACTION_GET_CONTENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("image/*");
                }

                try {
                    startActivityForResult(Intent.createChooser(intent, "Chọn hình ảnh"), FILE_CHOOSER_REQUEST_CODE);
                    return true;
                } catch (ActivityNotFoundException e) {
                    try {
                        Intent fallback = new Intent(Intent.ACTION_GET_CONTENT);
                        fallback.addCategory(Intent.CATEGORY_OPENABLE);
                        fallback.setType("image/*");
                        startActivityForResult(fallback, FILE_CHOOSER_REQUEST_CODE);
                        return true;
                    } catch (Exception ex) {
                        if (fileUploadCallback != null) {
                            fileUploadCallback.onReceiveValue(null);
                            fileUploadCallback = null;
                        }
                        Toast.makeText(MainActivity.this, "Không thể mở bộ chọn ảnh", Toast.LENGTH_SHORT).show();
                        return false;
                    }
                }
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                Uri uri = request.getUrl();
                if ("tgpos".equals(uri.getScheme()) && "print".equals(uri.getHost())) {
                    if (!isAppHost(Uri.parse(view.getUrl()))) return true;
                    String paper = uri.getQueryParameter("paper");
                    String connection = uri.getQueryParameter("connection");
                    boolean autoCut = !"0".equals(uri.getQueryParameter("cut"));
                    String ipAddress = uri.getQueryParameter("ip");
                    if ("bluetooth".equals(connection) || "usb".equals(connection) || "rawbt".equals(connection) || "lan".equals(connection) || "network".equals(connection)) {
                        if (!"58mm".equals(paper) && !"80mm".equals(paper) && !"85mm".equals(paper)) {
                            Toast.makeText(MainActivity.this, "Chọn khổ K58, K80 hoặc K85 để in nhiệt", Toast.LENGTH_LONG).show();
                            return true;
                        }
                        String sourceUrl = view.getUrl();
                        // Older website builds don't fill receipt_ip_address. Read the
                        // same-store saved preference as a compatibility fallback.
                        view.evaluateJavascript("(function(){var saved=window.menuPersistence&&typeof window.menuPersistence.read==='function'?window.menuPersistence.read('printer',{}):{};return {text:window.invoiceModule&&window.invoiceModule.receiptText||'',qrUrl:window.invoiceModule&&window.invoiceModule.receiptQrUrl||'',footer:window.invoiceModule&&window.invoiceModule.receiptFooterText||'',ip:window.appState&&window.appState.storeSettings&&window.appState.storeSettings.receipt_ip_address||saved.ipAddress||''}})()", value -> {
                            if (!sourceUrl.equals(view.getUrl())) return;
                            try {
                                Object receipt = new org.json.JSONTokener(value).nextValue();
                                if (receipt instanceof org.json.JSONObject) {
                                    org.json.JSONObject data = (org.json.JSONObject) receipt;
                                    String resolvedIp = ipAddress != null && !ipAddress.trim().isEmpty() ? ipAddress : data.optString("ip");
                                    thermalPrinter.print(data.optString("text"), paper, connection, data.optString("qrUrl"), data.optString("footer"), autoCut, resolvedIp);
                                }
                                else Toast.makeText(MainActivity.this, "Chưa đọc được dữ liệu hóa đơn. Hãy mở lại phiếu.", Toast.LENGTH_LONG).show();
                            } catch (Exception error) { Toast.makeText(MainActivity.this, "Không đọc được dữ liệu hóa đơn", Toast.LENGTH_LONG).show(); }
                        });
                    } else printReceipt(paper);
                    return true;
                }
                if (isAppHost(uri)) {
                    if (isAdminPath(uri)) {
                        returnToPosLogin(view);
                        return true;
                    }
                    return false;
                }
                if ("https".equals(uri.getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
                    catch (ActivityNotFoundException ignored) { Toast.makeText(MainActivity.this, "Không mở được liên kết", Toast.LENGTH_SHORT).show(); }
                }
                return true;
            }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                loadFailed = false;
                pageLoaded = false;
                errorView.setVisibility(View.GONE);
                progress.setVisibility(View.VISIBLE);
                view.setVisibility(View.INVISIBLE);
            }
            @Override public void onPageFinished(WebView view, String url) {
                Uri uri = Uri.parse(url);
                if (isAdminPath(uri)) {
                    returnToPosLogin(view);
                    return;
                }
                if (loadFailed || !isAppHost(uri) || !url.equals(view.getUrl())) return;
                pageLoaded = true;
                applyInsetsToWebView();
                view.evaluateJavascript(APP_BRIDGE_SCRIPT, ignored -> {
                    if (!url.equals(view.getUrl())) return;
                    view.clearHistory();
                    progress.setVisibility(View.GONE);
                    view.setVisibility(View.VISIBLE);
                });
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (!request.isForMainFrame()) return;
                loadFailed = true;
                pageLoaded = false;
                progress.setVisibility(View.GONE);
                view.setVisibility(View.INVISIBLE);
                errorView.setVisibility(View.VISIBLE);
            }
        });

        if (state == null || webView.restoreState(state) == null) webView.loadUrl(POS_URL);
    }

    private void setupEdgeToEdge() {
        try {
            Window window = getWindow();

            // 1. Vẽ xuyên qua tai thỏ / camera cutout
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                WindowManager.LayoutParams lp = window.getAttributes();
                lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
                window.setAttributes(lp);
            }

            // 2. Kích hoạt vẽ tràn viền và trong suốt thanh hệ thống
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                window.setDecorFitsSystemWindows(false);
                window.setStatusBarColor(Color.TRANSPARENT);
                window.setNavigationBarColor(Color.TRANSPARENT);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    window.setStatusBarContrastEnforced(false);
                    window.setNavigationBarContrastEnforced(false);
                }
                WindowInsetsController controller = window.getInsetsController();
                if (controller != null) {
                    // Header nền sẫm -> icon pin, sóng, giờ màu trắng sáng
                    controller.setSystemBarsAppearance(0, WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS);
                    // Đáy nền trắng -> icon/thanh gạch cử chỉ màu tối
                    controller.setSystemBarsAppearance(
                            WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS,
                            WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                int flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                window.getDecorView().setSystemUiVisibility(flags);
                window.setStatusBarColor(Color.TRANSPARENT);
                window.setNavigationBarColor(Color.TRANSPARENT);
            }
        } catch (Throwable ignored) {
            // Không bao giờ để lỗi cấu hình UI làm gián đoạn khởi động app
        }
    }

    private void applyInsetsToWebView() {
        if (webView == null || !pageLoaded) return;
        try {
            String js = String.format(java.util.Locale.US,
                    "(function(){"
                    + "var top='%dpx',bottom='%dpx',left='%dpx',right='%dpx';"
                    + "var d=document.documentElement;"
                    + "if(d){"
                    + "d.style.setProperty('--android-inset-top',top);"
                    + "d.style.setProperty('--android-inset-bottom',bottom);"
                    + "d.style.setProperty('--android-inset-left',left);"
                    + "d.style.setProperty('--android-inset-right',right);"
                    + "d.style.setProperty('--safe-top',top);"
                    + "d.style.setProperty('--safe-bottom',bottom);"
                    + "d.style.setProperty('--safe-left',left);"
                    + "d.style.setProperty('--safe-right',right);"
                    + "}"
                    + "var st=document.getElementById('android-e2e-style');"
                    + "if(!st&&document.head){"
                    + "st=document.createElement('style');"
                    + "st.id='android-e2e-style';"
                    + "document.head.appendChild(st);"
                    + "}"
                    + "if(st){"
                    + "st.textContent='@media(max-width:520px){"
                    + ":root{--header-height:calc(58px + '+top+')!important;--bottom-nav-height:calc(64px + '+bottom+')!important;}"
                    + ".top-header{min-height:calc(58px + '+top+')!important;padding-top:'+top+'!important;}"
                    + ".bottom-nav-bar{min-height:calc(64px + '+bottom+')!important;height:calc(64px + '+bottom+')!important;padding-bottom:'+bottom+'!important;}"
                    + ".main-content{margin-bottom:calc(64px + '+bottom+')!important;}"
                    + "}';"
                    + "}"
                    + "})()",
                    insetTopDp, insetBottomDp, insetLeftDp, insetRightDp);
            webView.evaluateJavascript(js, null);
        } catch (Throwable ignored) {}
    }

    private boolean isAppHost(Uri uri) {
        return "https".equals(uri.getScheme()) && HOST.equalsIgnoreCase(uri.getHost());
    }

    // Audio uses a native interface so announcements cannot cancel a print URL navigation.
    public final class AudioBridge {
        @android.webkit.JavascriptInterface public void beep(int volume) {
            runOnUiThread(() -> {
                if (!isFinishing() && !isDestroyed() && webView.getUrl() != null && isAppHost(Uri.parse(webView.getUrl()))) nativeSpeaker.beep(Math.max(0, Math.min(100, volume)));
            });
        }
        @android.webkit.JavascriptInterface public void speak(String text, int volume) {
            runOnUiThread(() -> {
                if (!isFinishing() && !isDestroyed() && webView.getUrl() != null && isAppHost(Uri.parse(webView.getUrl()))) nativeSpeaker.speak(text, Math.max(0, Math.min(100, volume)));
            });
        }
    }
    private boolean isAdminPath(Uri uri) {
        String path = uri.getPath();
        return isAppHost(uri) && path != null && (path.equals("/admin")
                || path.equals("/admin.html") || path.startsWith("/admin/"));
    }
    private void returnToPosLogin(WebView view) {
        view.stopLoading();
        view.evaluateJavascript(CLEAR_ADMIN_SESSION_SCRIPT, ignored -> {
            view.clearHistory();
            view.loadUrl(POS_URL);
            Toast.makeText(MainActivity.this,
                    "Ứng dụng chỉ dành cho nhân viên POS, không hỗ trợ tài khoản quản trị.",
                    Toast.LENGTH_LONG).show();
        });
    }
    private void printReceipt(String paperSize) {
        PrintManager printer = (PrintManager) getSystemService(PRINT_SERVICE);
        if (printer == null) return;
        boolean narrow = "58mm".equalsIgnoreCase(paperSize);
        boolean wide85 = "85mm".equalsIgnoreCase(paperSize);
        PrintAttributes.MediaSize media = new PrintAttributes.MediaSize(
                narrow ? "POS_58MM" : (wide85 ? "POS_85MM" : "POS_80MM"),
                narrow ? "Hóa đơn 58 mm" : (wide85 ? "Hóa đơn 85 mm" : "Hóa đơn 80 mm"),
                narrow ? 2283 : (wide85 ? 3346 : 3150), 11693);
        if ("A4".equalsIgnoreCase(paperSize)) media = PrintAttributes.MediaSize.ISO_A4;
        PrintAttributes options = new PrintAttributes.Builder()
                .setMediaSize(media)
                .setColorMode(PrintAttributes.COLOR_MODE_MONOCHROME)
                .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                .build();
        printer.print("Onesoft POS - Hóa đơn", webView.createPrintDocumentAdapter("Hóa đơn Onesoft POS"), options);
    }
    // Android 13+ uses the callback registered in onCreate; older devices use this method.
    @android.annotation.SuppressLint("GestureBackNavigation")
    @Override public void onBackPressed() { handleBack(); }

    private void handleBack() {
        if (webView.canGoBack()) webView.goBack();
        else new AlertDialog.Builder(this).setMessage("Thoát Onesoft POS?")
                .setNegativeButton("Ở lại", null).setPositiveButton("Thoát", (dialog, which) -> finish()).show();
    }
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            if (fileUploadCallback == null) return;
            Uri[] results = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
            fileUploadCallback.onReceiveValue(results);
            fileUploadCallback = null;
        }
    }

    @Override protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }
    @Override protected void onDestroy() {
        nativeSpeaker.close();
        thermalPrinter.close();
        if (fileUploadCallback != null) {
            fileUploadCallback.onReceiveValue(null);
            fileUploadCallback = null;
        }
        ((ViewGroup) webView.getParent()).removeView(webView);
        webView.destroy();
        super.onDestroy();
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == ThermalPrinter.BLUETOOTH_PERMISSION) thermalPrinter.onBluetoothPermission(
                grantResults.length > 0 && grantResults[0] == android.content.pm.PackageManager.PERMISSION_GRANTED);
    }
}
