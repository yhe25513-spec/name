package com.textadventure.game

import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webview)

        // 配置 WebView
        val webSettings: WebSettings = webView.settings
        webSettings.javaScriptEnabled = true
        webSettings.domStorageEnabled = true
        webSettings.databaseEnabled = true
        webSettings.setSupportZoom(false)
        webSettings.loadWithOverviewMode = true
        webSettings.useWideViewPort = true

        // 处理弹窗和对话框
        webView.webChromeClient = WebChromeClient()

        // 防止跳转外部浏览器
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                return false
            }
        }

        // 加载游戏网址（先使用本地开发地址，部署后改为你的 Vercel 地址）
        webView.loadUrl("http://192.168.1.100:3000")
        // webView.loadUrl("https://your-game.vercel.app")
    }

    override fun onBackPressed() {
        // 如果 WebView 可以返回，优先返回页面
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
