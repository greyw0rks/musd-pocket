package tech.mpocket.testing;

import android.app.Dialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Message;
import android.webkit.CookieManager;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import com.journeyapps.barcodescanner.ScanContract;
import com.journeyapps.barcodescanner.ScanOptions;
import java.io.IOException;
import java.util.Collections;
import org.json.JSONException;
import org.json.JSONObject;

/** Bundled screens at the existing HTTPS origin; APIs and wallet requests stay live. */
public class LauncherActivity extends AppCompatActivity {
    private static final String HOME = PocketNavigation.HOME;
    private WebView web;
    private LinearLayout container;
    private JavaScriptReplyProxy scanReply;
    private int scanId;
    private final ActivityResultLauncher<ScanOptions> scanner = registerForActivityResult(new ScanContract(), result -> {
        if (scanReply != null) reply(scanReply, scanId, result.getContents(), null);
        scanReply = null;
    });

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        container = new LinearLayout(this);
        container.setOrientation(LinearLayout.VERTICAL);
        container.setBackgroundColor(Color.rgb(244, 244, 246));
        setContentView(container);
        ViewCompat.setOnApplyWindowInsetsListener(container, (view, insets) -> {
            androidx.core.graphics.Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.ime());
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return WindowInsetsCompat.CONSUMED;
        });
        openApp(intentUrl(getIntent()));
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                if (web == null) { finish(); return; }
                web.evaluateJavascript("window.__pocketAndroidBack ? window.__pocketAndroidBack() : false", result -> {
                    if ("true".equals(result)) return;
                    if (web != null && web.canGoBack()) web.goBack();
                    else moveTaskToBack(true);
                });
            }
        });
    }

    private String intentUrl(Intent intent) {
        Uri data = intent.getData();
        return PocketNavigation.intentUrl(data == null ? null : data.toString());
    }
    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (web != null) web.loadUrl(intentUrl(intent));
    }
    private boolean isPocket(Uri uri) {
        return PocketNavigation.isPocket(uri.toString());
    }
    private void configure(WebView view) {
        WebSettings settings = view.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(view, true);
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_AUTHENTICATION))
            WebSettingsCompat.setWebAuthenticationSupport(settings, WebSettingsCompat.WEB_AUTHENTICATION_SUPPORT_FOR_APP);
    }

    private void openApp(String url) {
        if (web != null) { container.removeView(web); web.destroy(); web = null; }
        container.removeAllViews();
        try {
            web = new WebView(this);
            configure(web);
            WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
            if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
                WebViewCompat.addWebMessageListener(web, "PocketNative", Collections.singleton("https://mpocket.tech"),
                    (view, message, origin, mainFrame, response) -> {
                        if (!mainFrame || !isPocket(origin)) return;
                        try {
                            JSONObject data = new JSONObject(message.getData());
                            int id = data.getInt("id");
                            String action = data.getString("action");
                            if ("scan".equals(action)) {
                                if (scanReply != null) { reply(response, id, null, "The camera is already open."); return; }
                                scanReply = response;
                                scanId = id;
                                ScanOptions options = new ScanOptions().setDesiredBarcodeFormats(ScanOptions.QR_CODE)
                                    .setPrompt("Scan a Pocket payment code").setBeepEnabled(false).setOrientationLocked(false);
                                try { scanner.launch(options); }
                                catch (RuntimeException error) { scanReply = null; reply(response, id, null, "The camera could not open. Paste the payment link instead."); }
                            } else if ("share".equals(action)) {
                                String text = data.optString("value");
                                if (text.length() > 8192) { reply(response, id, null, "This link is too long to share."); return; }
                                Intent share = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text);
                                try {
                                    startActivity(Intent.createChooser(share, "Share with"));
                                    reply(response, id, null, null);
                                } catch (ActivityNotFoundException error) { reply(response, id, null, "No sharing app is available."); }
                            } else reply(response, id, null, "Unknown action.");
                        } catch (JSONException ignored) { }
                    });
            }
            WebViewAssetLoader assets = new WebViewAssetLoader.Builder().setDomain("mpocket.tech")
                .addPathHandler("/_android/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
            web.setWebViewClient(new WebViewClient() {
                @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                    Uri uri = request.getUrl();
                    if (!isPocket(uri) || !"GET".equals(request.getMethod())) return null;
                    if (request.isForMainFrame() && PocketNavigation.isBundledRoute(uri.toString())) {
                        try {
                            return new WebResourceResponse("text/html", "UTF-8", 200, "OK", Collections.singletonMap("Cache-Control", "no-store"), getAssets().open("web/index.html"));
                        } catch (IOException error) { return new WebResourceResponse("text/plain", "UTF-8", 500, "Missing app bundle", Collections.emptyMap(), null); }
                    }
                    return assets.shouldInterceptRequest(uri);
                }
                @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    Uri uri = request.getUrl();
                    if (!request.isForMainFrame()) return false;
                    if (isPocket(uri) && uri.getQueryParameter("browser") == null) return false;
                    if (PocketNavigation.isOAuthHost(uri.toString())) return false;
                    external(uri);
                    return true;
                }
                @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                    container.removeView(view);
                    view.destroy();
                    web = null;
                    recovery("Android stopped the app’s display. You can reopen it now.");
                    return true;
                }
            });
            web.setWebChromeClient(chrome(assets));
            container.addView(web, new LinearLayout.LayoutParams(-1, -1));
            web.loadUrl(url);
        } catch (RuntimeException error) {
            recovery("The Android display component could not start. Update Android System WebView, then try again.");
        }
    }

    private WebChromeClient chrome(WebViewAssetLoader assets) {
        return new WebChromeClient() {
            @Override public boolean onCreateWindow(WebView view, boolean dialogWindow, boolean userGesture, Message result) {
                // OAuth needs the window.opener transport and shared cookies. No bridge in popups.
                Dialog dialog = new Dialog(LauncherActivity.this, android.R.style.Theme_DeviceDefault_Light_NoActionBar);
                LinearLayout layout = new LinearLayout(LauncherActivity.this);
                layout.setOrientation(LinearLayout.VERTICAL);
                Button close = new Button(LauncherActivity.this);
                close.setText("Close sign-in window");
                WebView popup = new WebView(LauncherActivity.this);
                configure(popup);
                popup.setWebViewClient(new WebViewClient() {
                    @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest request) {
                        // The return page also needs the bundled Privy client to
                        // relay the callback to its opener, without a native bridge.
                        Uri uri = request.getUrl();
                        if (!isPocket(uri) || !"GET".equals(request.getMethod())) return null;
                        if (request.isForMainFrame() && PocketNavigation.isBundledRoute(uri.toString())) {
                            try {
                                return new WebResourceResponse("text/html", "UTF-8", 200, "OK", Collections.singletonMap("Cache-Control", "no-store"), getAssets().open("web/index.html"));
                            } catch (IOException error) { return new WebResourceResponse("text/plain", "UTF-8", 500, "Missing app bundle", Collections.emptyMap(), null); }
                        }
                        return assets.shouldInterceptRequest(uri);
                    }
                    @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest request) {
                        if ("https".equals(request.getUrl().getScheme())) return false;
                        external(request.getUrl());
                        return true;
                    }
                });
                popup.setWebChromeClient(new WebChromeClient() {
                    @Override public void onCloseWindow(WebView window) { dialog.dismiss(); }
                });
                close.setOnClickListener(v -> dialog.dismiss());
                layout.addView(close);
                layout.addView(popup, new LinearLayout.LayoutParams(-1, 0, 1));
                dialog.setContentView(layout);
                dialog.setOnDismissListener(d -> popup.destroy());
                dialog.show();
                dialog.getWindow().setLayout(-1, -1);
                ViewCompat.setOnApplyWindowInsetsListener(layout, (v, insets) -> {
                    androidx.core.graphics.Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.ime());
                    v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                    return WindowInsetsCompat.CONSUMED;
                });
                WebView.WebViewTransport transport = (WebView.WebViewTransport) result.obj;
                transport.setWebView(popup);
                result.sendToTarget();
                return true;
            }
        };
    }
    private void reply(JavaScriptReplyProxy response, int id, String result, String error) {
        try {
            JSONObject data = new JSONObject().put("id", id).put("result", result == null ? JSONObject.NULL : result);
            if (error != null) data.put("error", error);
            response.postMessage(data.toString());
        } catch (JSONException ignored) { }
    }
    private void external(Uri uri) {
        if (!"https".equals(uri.getScheme()) && !"mailto".equals(uri.getScheme())) return;
        try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
        catch (ActivityNotFoundException ignored) { recovery("No app is available to open that link. Return to Pocket and try another sign-in method."); }
    }
    private void recovery(String message) {
        if (web != null) { container.removeView(web); web.destroy(); web = null; }
        container.removeAllViews();
        TextView text = new TextView(this);
        text.setText("mPocket\n\n" + message);
        text.setTextSize(18);
        text.setPadding(48, 72, 48, 48);
        Button retry = new Button(this);
        retry.setText("Try again");
        retry.setOnClickListener(v -> openApp(HOME));
        Button browser = new Button(this);
        browser.setText("Open in browser");
        browser.setOnClickListener(v -> external(Uri.parse(HOME)));
        container.addView(text);
        container.addView(retry);
        container.addView(browser);
    }
    @Override protected void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
        if (web != null) web.onPause();
    }
    @Override protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
    }
    @Override protected void onDestroy() {
        if (web != null) { container.removeView(web); web.destroy(); web = null; }
        super.onDestroy();
    }
}
