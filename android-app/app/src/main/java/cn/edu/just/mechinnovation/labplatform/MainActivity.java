package cn.edu.just.mechinnovation.labplatform;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.os.Bundle;
import android.os.Environment;
import android.os.Message;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.URLUtil;
import android.widget.FrameLayout;
import android.widget.ProgressBar;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

public class MainActivity extends Activity {
    private static final String START_URL =
            "https://1763107202-afk.github.io/modelhub/?android=1";
    private static final String PLATFORM_HOST = "1763107202-afk.github.io";
    private static final String PLATFORM_PREFIX = "/modelhub";
    private static final int FILE_CHOOSER_REQUEST = 9001;

    private WebView webView;
    private ProgressBar progressBar;
    private ValueCallback<Uri[]> fileChooserCallback;
    private ConnectivityManager connectivityManager;
    private volatile Network cellularNetwork;
    private ConnectivityManager.NetworkCallback cellularCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setStatusBarColor(Color.rgb(12, 20, 31));
        getWindow().setNavigationBarColor(Color.rgb(12, 20, 31));

        FrameLayout root = new FrameLayout(this);
        webView = new WebView(this);
        progressBar = new ProgressBar(
                this, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setMax(100);

        root.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));

        FrameLayout.LayoutParams progressParams = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                dp(3));
        progressParams.gravity = android.view.Gravity.TOP;
        root.addView(progressBar, progressParams);
        setContentView(root);

        configureCellularFallback();
        configureWebView();

        if (savedInstanceState == null) {
            webView.loadUrl(START_URL);
        } else {
            webView.restoreState(savedInstanceState);
        }
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void configureWebView() {
        WebView.setWebContentsDebuggingEnabled(false);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportMultipleWindows(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setUserAgentString(
                settings.getUserAgentString() + " JUSTLabAndroid/1.1.0");

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(webView, true);

        webView.addJavascriptInterface(new NetworkBridge(), "JUSTNetworkBridge");
        webView.setWebViewClient(new PlatformWebViewClient());
        webView.setWebChromeClient(new PlatformWebChromeClient());

        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) ->
                downloadFile(url, userAgent, contentDisposition, mimeType));
    }

    private void configureCellularFallback() {
        connectivityManager =
                (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (connectivityManager == null) return;

        NetworkRequest request = new NetworkRequest.Builder()
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .addTransportType(NetworkCapabilities.TRANSPORT_CELLULAR)
                .build();

        cellularCallback = new ConnectivityManager.NetworkCallback() {
            @Override
            public void onAvailable(Network network) {
                cellularNetwork = network;
            }

            @Override
            public void onLost(Network network) {
                if (cellularNetwork != null && cellularNetwork.equals(network)) {
                    cellularNetwork = null;
                }
            }
        };

        try {
            connectivityManager.requestNetwork(request, cellularCallback);
        } catch (Exception ignored) {
            cellularNetwork = null;
        }
    }

    private static String readAll(InputStream stream) throws Exception {
        if (stream == null) return "";
        StringBuilder out = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            char[] buffer = new char[8192];
            int count;
            while ((count = reader.read(buffer)) >= 0) {
                out.append(buffer, 0, count);
            }
        }
        return out.toString();
    }

    private class NetworkBridge {
        @JavascriptInterface
        public String request(String method, String url, String headersJson, String body) {
            JSONObject result = new JSONObject();
            HttpURLConnection connection = null;
            try {
                Uri uri = Uri.parse(url);
                if (!"https".equalsIgnoreCase(uri.getScheme())
                        || !"yodtphuzgngxpihnfwop.supabase.co".equalsIgnoreCase(uri.getHost())) {
                    result.put("error", "备用线路仅允许访问实验室 Supabase 服务");
                    return result.toString();
                }

                Network network = cellularNetwork;
                if (network == null) {
                    result.put("error", "当前没有可用的移动数据备用线路");
                    return result.toString();
                }

                URL target = new URL(url);
                connection = (HttpURLConnection) network.openConnection(target);
                connection.setRequestMethod(method == null ? "GET" : method.toUpperCase());
                connection.setConnectTimeout(8000);
                connection.setReadTimeout(16000);
                connection.setInstanceFollowRedirects(true);
                connection.setUseCaches(false);

                JSONObject headers = headersJson == null || headersJson.isEmpty()
                        ? new JSONObject()
                        : new JSONObject(headersJson);
                java.util.Iterator<String> keys = headers.keys();
                while (keys.hasNext()) {
                    String key = keys.next();
                    if ("host".equalsIgnoreCase(key)
                            || "content-length".equalsIgnoreCase(key)
                            || "connection".equalsIgnoreCase(key)) {
                        continue;
                    }
                    connection.setRequestProperty(key, headers.optString(key, ""));
                }

                String safeBody = body == null ? "" : body;
                if (!safeBody.isEmpty()
                        && !"GET".equalsIgnoreCase(method)
                        && !"HEAD".equalsIgnoreCase(method)) {
                    connection.setDoOutput(true);
                    byte[] bytes = safeBody.getBytes(StandardCharsets.UTF_8);
                    connection.setFixedLengthStreamingMode(bytes.length);
                    try (OutputStream output = connection.getOutputStream()) {
                        output.write(bytes);
                    }
                }

                int status = connection.getResponseCode();
                InputStream stream = status >= 400
                        ? connection.getErrorStream()
                        : connection.getInputStream();
                String responseBody = readAll(stream);

                JSONObject responseHeaders = new JSONObject();
                for (Map.Entry<String, List<String>> entry
                        : connection.getHeaderFields().entrySet()) {
                    if (entry.getKey() == null || entry.getValue() == null) continue;
                    responseHeaders.put(entry.getKey(),
                            android.text.TextUtils.join(", ", entry.getValue()));
                }

                result.put("status", status);
                result.put("body", responseBody);
                result.put("headers", responseHeaders);
                return result.toString();
            } catch (Exception ex) {
                try {
                    result.put("error",
                            ex.getMessage() == null ? "移动数据备用线路请求失败" : ex.getMessage());
                } catch (Exception ignored) {}
                return result.toString();
            } finally {
                if (connection != null) connection.disconnect();
            }
        }
    }

    private boolean isPlatformUrl(Uri uri) {
        if (uri == null) return false;
        String scheme = uri.getScheme();
        String host = uri.getHost();
        String path = uri.getPath();
        return "https".equalsIgnoreCase(scheme)
                && PLATFORM_HOST.equalsIgnoreCase(host)
                && path != null
                && path.startsWith(PLATFORM_PREFIX);
    }

    private boolean handleNavigation(Uri uri) {
        if (uri == null) return true;

        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();

        if ("about".equals(scheme) || "javascript".equals(scheme) || "blob".equals(scheme)) {
            return false;
        }

        if (("http".equals(scheme) || "https".equals(scheme)) && isPlatformUrl(uri)) {
            return false;
        }

        if ("http".equals(scheme) || "https".equals(scheme)
                || "mailto".equals(scheme) || "tel".equals(scheme)
                || "sms".equals(scheme) || "geo".equals(scheme)
                || "market".equals(scheme) || "intent".equals(scheme)) {
            openExternal(uri);
            return true;
        }

        return true;
    }

    private void openExternal(Uri uri) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            intent.addCategory(Intent.CATEGORY_BROWSABLE);
            startActivity(intent);
        } catch (ActivityNotFoundException ex) {
            Toast.makeText(this, "没有找到可打开该链接的应用", Toast.LENGTH_SHORT).show();
        } catch (Exception ex) {
            Toast.makeText(this, "链接打开失败，请稍后重试", Toast.LENGTH_SHORT).show();
        }
    }

    private void downloadFile(
            String url,
            String userAgent,
            String contentDisposition,
            String mimeType) {
        if (url == null || url.isEmpty()) return;

        if (url.startsWith("blob:")) {
            Toast.makeText(
                    this,
                    "该文件由网页临时生成，请在系统浏览器中打开对应页面后下载。",
                    Toast.LENGTH_LONG).show();
            return;
        }

        try {
            Uri uri = Uri.parse(url);
            if (!"http".equalsIgnoreCase(uri.getScheme())
                    && !"https".equalsIgnoreCase(uri.getScheme())) {
                openExternal(uri);
                return;
            }

            String fileName = URLUtil.guessFileName(url, contentDisposition, mimeType);
            DownloadManager.Request request = new DownloadManager.Request(uri);
            request.setTitle(fileName);
            request.setDescription("正在下载实验室资料");
            if (mimeType != null && !mimeType.isEmpty()) request.setMimeType(mimeType);
            if (userAgent != null && !userAgent.isEmpty()) {
                request.addRequestHeader("User-Agent", userAgent);
            }

            String cookie = CookieManager.getInstance().getCookie(url);
            if (cookie != null && !cookie.isEmpty()) {
                request.addRequestHeader("Cookie", cookie);
            }

            request.setAllowedOverMetered(true);
            request.setAllowedOverRoaming(true);
            request.setNotificationVisibility(
                    DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalPublicDir(
                    Environment.DIRECTORY_DOWNLOADS, fileName);

            DownloadManager manager =
                    (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            manager.enqueue(request);
            Toast.makeText(this, "已加入下载任务：" + fileName, Toast.LENGTH_SHORT).show();
        } catch (Exception ex) {
            try {
                openExternal(Uri.parse(url));
            } catch (Exception ignored) {
                Toast.makeText(this, "下载失败，请使用系统浏览器重试", Toast.LENGTH_LONG).show();
            }
        }
    }

    private class PlatformWebViewClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return handleNavigation(request.getUrl());
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            return handleNavigation(Uri.parse(url));
        }

        @Override
        public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
            progressBar.setVisibility(View.VISIBLE);
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            progressBar.setVisibility(View.GONE);
            CookieManager.getInstance().flush();
        }
    }

    private class PlatformWebChromeClient extends WebChromeClient {
        @Override
        public void onProgressChanged(WebView view, int newProgress) {
            progressBar.setProgress(newProgress);
            progressBar.setVisibility(newProgress >= 100 ? View.GONE : View.VISIBLE);
        }

        @Override
        public boolean onShowFileChooser(
                WebView webView,
                ValueCallback<Uri[]> filePathCallback,
                FileChooserParams fileChooserParams) {
            if (fileChooserCallback != null) {
                fileChooserCallback.onReceiveValue(null);
            }
            fileChooserCallback = filePathCallback;

            try {
                Intent intent = fileChooserParams.createIntent();
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                startActivityForResult(intent, FILE_CHOOSER_REQUEST);
                return true;
            } catch (ActivityNotFoundException ex) {
                fileChooserCallback = null;
                Toast.makeText(
                        MainActivity.this,
                        "未找到系统文件选择器",
                        Toast.LENGTH_SHORT).show();
                return false;
            }
        }

        @Override
        public boolean onCreateWindow(
                WebView view,
                boolean isDialog,
                boolean isUserGesture,
                Message resultMsg) {
            WebView popup = new WebView(MainActivity.this);
            popup.getSettings().setJavaScriptEnabled(true);
            popup.setWebViewClient(new WebViewClient() {
                private boolean route(Uri uri) {
                    if (isPlatformUrl(uri)) {
                        webView.loadUrl(uri.toString());
                    } else {
                        openExternal(uri);
                    }
                    popup.destroy();
                    return true;
                }

                @Override
                public boolean shouldOverrideUrlLoading(
                        WebView view, WebResourceRequest request) {
                    return route(request.getUrl());
                }

                @Override
                public boolean shouldOverrideUrlLoading(WebView view, String url) {
                    return route(Uri.parse(url));
                }
            });

            WebView.WebViewTransport transport =
                    (WebView.WebViewTransport) resultMsg.obj;
            transport.setWebView(popup);
            resultMsg.sendToTarget();
            return true;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_REQUEST) {
            if (fileChooserCallback != null) {
                Uri[] result = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
                fileChooserCallback.onReceiveValue(result);
                fileChooserCallback = null;
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    protected void onDestroy() {
        if (connectivityManager != null && cellularCallback != null) {
            try {
                connectivityManager.unregisterNetworkCallback(cellularCallback);
            } catch (Exception ignored) {}
        }
        if (webView != null) {
            webView.loadUrl("about:blank");
            webView.stopLoading();
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
