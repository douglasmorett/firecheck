package com.grupohakim.firecheck;

import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onStart() {
        super.onStart();

        // Garante que o WebView conceda automaticamente permissões de câmera/áudio
        // quando solicitadas via navigator.mediaDevices.getUserMedia()
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            webView.setWebChromeClient(new WebChromeClient() {
                @Override
                public void onPermissionRequest(final PermissionRequest request) {
                    // Concede automaticamente permissões de câmera e áudio ao WebView
                    runOnUiThread(() -> request.grant(request.getResources()));
                }
            });
        }
    }
}
