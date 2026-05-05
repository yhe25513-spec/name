# APK 构建指南

将文字冒险游戏打包成 Android APK 安装包。

## 前置条件

1. **Node.js** (v18+)
2. **Android Studio** - 下载地址：https://developer.android.com/studio
3. **Android SDK** - 通过 Android Studio 安装
4. **Java JDK** (v11+) - 通过 Android Studio 自动安装

## 快速开始

### 方式一：使用构建脚本（推荐）

```bash
# 在项目根目录执行
build-apk.bat
```

脚本会自动：
1. 构建 Next.js 静态文件
2. 同步到 Capacitor
3. 打开 Android Studio
4. 在 Android Studio 中点击 Build → Build APK

### 方式二：手动步骤

```bash
# 1. 安装 Capacitor（如果还没安装）
npm install @capacitor/core @capacitor/cli @capacitor/android

# 2. 构建 Web 应用
npm run build

# 3. 初始化 Android 项目（第一次需要）
npx cap add android

# 4. 同步 Web 文件到 Android
npx cap sync android

# 5. 打开 Android Studio
npx cap open android

# 6. 在 Android Studio 中：
#    Build → Build Bundle(s) / APK(s) → Build APK(s)
```

## 输出位置

构建完成后，APK 文件位于：
```
android/app/build/outputs/apk/debug/app-debug.apk
```

## 安装到手机

1. 开启手机 **开发者模式** 和 **USB 调试**
2. 用 USB 连接电脑
3. 在 Android Studio 点击运行按钮，或
4. 手动复制 APK 到手机安装

## 发布给别人使用

1. 复制 `app-debug.apk` 文件给别人
2. 对方需要在手机设置中开启 **"允许安装未知来源应用"**
3. 直接点击 APK 文件安装

## 注意事项

1. **Supabase 配置**：确保 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 已正确配置
2. **网络权限**：应用需要联网，会自动申请 INTERNET 权限
3. **API 地址**：如果使用 localhost 后端，手机无法访问，需部署到公网

## 常见问题

### Q: 构建失败，提示 Gradle 错误？
A: 确保 Android Studio 已完全下载所有依赖，第一次打开会下载 Gradle。

### Q: 安装后无法登录？
A: 检查 Supabase 配置是否正确，且 URL 必须是公网可访问的（不能用 localhost）。

### Q: 如何生成正式签名 APK？
A: 在 Android Studio 中：
1. Build → Generate Signed Bundle / APK
2. 创建密钥库文件（.jks）
3. 选择 release 模式构建

## 文件说明

- `capacitor.config.ts` - Capacitor 配置文件
- `next.config.ts` - 已配置静态导出
- `android/` - 生成的 Android 项目目录（不要手动修改）
