@echo off
chcp 65001 >nul
echo ===================================
echo  文字冒险 - APK 构建脚本
echo ===================================
echo.

REM 检查 Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到 Node.js，请先安装 Node.js
    pause
    exit /b 1
)

REM 1. 构建 Next.js 静态文件
echo [1/4] 构建 Web 应用...
call npm run build
if errorlevel 1 (
    echo [错误] 构建失败
    pause
    exit /b 1
)

REM 2. 同步到 Capacitor
echo [2/4] 同步到 Capacitor...
call npx cap sync android

REM 3. 打开 Android Studio（可选）
echo [3/4] 准备打开 Android Studio...
echo.
echo ===================================
echo  构建说明：
echo ===================================
echo.
echo 方式1 - Android Studio（推荐）:
echo   1. 等待 Android Studio 打开
echo   2. 点击菜单 Build ^> Build Bundle(s) / APK(s) ^> Build APK(s)
echo   3. APK 将生成在 android/app/build/outputs/apk/debug/app-debug.apk
echo.
echo 方式2 - 命令行（需安装 Gradle）:
echo   cd android ^&^& ./gradlew assembleDebug
echo.
echo ===================================

REM 检查 Android Studio 是否可用
where studio.bat >nul 2>&1
if errorlevel 1 (
    where studio64.exe >nul 2>&1
    if errorlevel 1 (
        echo [提示] 未找到 Android Studio，请手动打开 android 目录
        echo 或安装 Android Studio：https://developer.android.com/studio
        explorer "android"
    ) else (
        call npx cap open android
    )
) else (
    call npx cap open android
)

pause
