# WebView APK 构建步骤

## 前置条件

1. 安装 Android Studio（推荐）或 IntelliJ IDEA
2. 安装 Java 17
3. 你的 Next.js 应用已部署到公网（Vercel/Railway 等）

---

## 第一步：修改网址

打开 `android-webview/app/src/main/java/com/textadventure/game/MainActivity.kt`

找到这一行：
```kotlin
webView.loadUrl("http://192.168.1.100:3000")
```

改成你的实际网址：
```kotlin
webView.loadUrl("https://your-game.vercel.app")
```

---

## 第二步：用 Android Studio 打开项目

1. 打开 Android Studio
2. 选择 **Open** → 选择 `android-webview` 文件夹
3. 等待 Gradle 同步完成（可能需要几分钟）

---

## 第三步：构建 APK

### 方式 A：通过 Android Studio GUI

1. 点击菜单栏 **Build → Build Bundle(s) / APK(s) → Build APK(s)**
2. 等待构建完成
3. 右下角会弹出通知，点击 **locate** 找到 APK 文件
4. 文件位置：`app/build/outputs/apk/debug/app-debug.apk`

### 方式 B：命令行构建

```bash
cd android-webview
./gradlew assembleDebug
```

APK 生成在：`app/build/outputs/apk/debug/app-debug.apk`

---

## 第四步：分发 APK

### 方式 1：直接发送
- 把 `app-debug.apk` 发给朋友
- 对方需要在手机设置里开启「允许安装未知来源应用」

### 方式 2：生成签名版（推荐用于正式分发）

1. **Build → Generate Signed Bundle / APK**
2. 选择 **APK**
3. 创建新的密钥库（Key Store）：
   - Key store path: 任意位置，如 `C:\Users\你\my-release-key.jks`
   - Password: 设置密码
   - Key alias: `key0`
   - 有效期: 25年
4. 选择 **release** 版本
5. 完成，获得 `app-release.apk`

---

## 常见问题

### 1. Gradle 同步失败
- 检查网络（需要能访问 Google）
- 或者使用国内镜像：在 `build.gradle` 顶部添加阿里云镜像

### 2. 安装后无法联网
- 检查网址是否正确
- 确保手机有网络权限
- 如果用自己的电脑IP（如 `192.168.x.x`），确保手机和电脑在同一WiFi

### 3. 如何更新
- 修改网址后重新构建
- 或者直接改 `MainActivity.kt` 里的 loadUrl

---

## 替代方案：PWA（更简单）

如果你只是想快速分享，不用做 APK：

1. 部署到 Vercel
2. 告诉用户：用手机浏览器打开网址
3. 点击菜单 → **添加到主屏幕**
4. 就能像 App 一样使用（全屏、离线可用）

---

## 下一步

现在你需要：
1. ✅ 把你的 Next.js 应用部署到 Vercel（获取公网网址）
2. ✅ 按上述步骤修改 MainActivity.kt 里的网址
3. ✅ 用 Android Studio 构建 APK
4. ✅ 分发 APK 给朋友

需要我帮你部署到 Vercel 吗？
