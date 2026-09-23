package vn.pro.giavdn.thichgapos;

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
import android.webkit.CookieManager;
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
    private static final String HOST = "thichgapos.giavdn.pro.vn";
    private static final String POS_URL = "https://" + HOST + "/?mode=pos";
    private static final String APP_BRIDGE_SCRIPT = "(function(){"
            + "window.print=function(){var paper=(window.appState&&window.appState.storeSettings&&window.appState.storeSettings.receipt_paper_size)||'80mm';"
            + "window.location.href='tgpos://print?paper='+encodeURIComponent(paper)}"
            + "})()";

    private WebView webView;
    private ProgressBar progress;
    private LinearLayout errorView;
    private boolean loadFailed;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        FrameLayout frame = new FrameLayout(this);
        frame.setBackgroundColor(Color.WHITE);
        setContentView(frame);
        if (Build.VERSION.SDK_INT >= 35) {
            frame.setOnApplyWindowInsetsListener((view, insets) -> {
                view.setPadding(0, insets.getSystemWindowInsetTop(), 0, insets.getSystemWindowInsetBottom());
                return insets;
            });
            frame.requestApplyInsets();
        }

        webView = new WebView(this);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        frame.addView(webView, new FrameLayout.LayoutParams(-1, -1));

        progress = new ProgressBar(this);
        FrameLayout.LayoutParams progressParams = new FrameLayout.LayoutParams(-2, -2, Gravity.CENTER);
        frame.addView(progress, progressParams);

        errorView = new LinearLayout(this);
        errorView.setOrientation(LinearLayout.VERTICAL);
        errorView.setGravity(Gravity.CENTER);
        errorView.setPadding(32, 32, 32, 32);
        TextView message = new TextView(this);
        message.setText("Không tải được Thích Gà POS. Hãy kiểm tra kết nối mạng.");
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
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(false);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);

        webView.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view, int newProgress) {
                if (!loadFailed && newProgress < 100) progress.setVisibility(View.VISIBLE);
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                Uri uri = request.getUrl();
                if ("tgpos".equals(uri.getScheme()) && "print".equals(uri.getHost())) {
                    printReceipt(uri.getQueryParameter("paper"));
                    return true;
                }
                if (isAppHost(uri)) {
                    if (isStandaloneAdminPath(uri)) {
                        view.loadUrl(POS_URL);
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
                errorView.setVisibility(View.GONE);
                progress.setVisibility(View.VISIBLE);
                view.setVisibility(View.INVISIBLE);
            }
            @Override public void onPageFinished(WebView view, String url) {
                Uri uri = Uri.parse(url);
                if (isStandaloneAdminPath(uri)) {
                    view.loadUrl(POS_URL);
                    return;
                }
                if (loadFailed || !isAppHost(uri) || !url.equals(view.getUrl())) return;
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
                progress.setVisibility(View.GONE);
                view.setVisibility(View.INVISIBLE);
                errorView.setVisibility(View.VISIBLE);
            }
        });

        if (state == null || webView.restoreState(state) == null) webView.loadUrl(POS_URL);
    }

    private boolean isAppHost(Uri uri) {
        return "https".equals(uri.getScheme()) && HOST.equalsIgnoreCase(uri.getHost());
    }
    private boolean isStandaloneAdminPath(Uri uri) {
        String path = uri.getPath();
        return isAppHost(uri) && path != null && (path.equals("/admin")
                || path.equals("/admin.html") || path.startsWith("/admin/"));
    }
    private void printReceipt(String paperSize) {
        PrintManager printer = (PrintManager) getSystemService(PRINT_SERVICE);
        if (printer == null) return;
        boolean narrow = "58mm".equalsIgnoreCase(paperSize);
        PrintAttributes.MediaSize media = new PrintAttributes.MediaSize(
                narrow ? "POS_58MM" : "POS_80MM", narrow ? "Hóa đơn 58 mm" : "Hóa đơn 80 mm",
                narrow ? 2283 : 3150, 11693);
        PrintAttributes options = new PrintAttributes.Builder()
                .setMediaSize(media)
                .setColorMode(PrintAttributes.COLOR_MODE_MONOCHROME)
                .build();
        printer.print("Thích Gà POS - Hóa đơn", webView.createPrintDocumentAdapter("Hóa đơn Thích Gà POS"), options);
    }
    @Override public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack();
        else new AlertDialog.Builder(this).setMessage("Thoát Thích Gà POS?")
                .setNegativeButton("Ở lại", null).setPositiveButton("Thoát", (dialog, which) -> finish()).show();
    }
    @Override protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }
    @Override protected void onDestroy() {
        ((ViewGroup) webView.getParent()).removeView(webView);
        webView.destroy();
        super.onDestroy();
    }
}
