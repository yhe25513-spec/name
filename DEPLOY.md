# 部署到 Vercel 指南

## 第一步：推送代码到 GitHub

如果你还没有 Git 仓库，先初始化：

```bash
# 在项目根目录执行
cd text-adventure-game

# 初始化 Git（如果还没做）
git init

# 添加所有文件
git add .

# 提交
git commit -m "Initial commit"

# 创建 GitHub 仓库（去 github.com 点击 New Repository）
# 然后关联并推送
git remote add origin https://github.com/你的用户名/仓库名.git
git push -u origin main
```

---

## 第二步：在 Vercel 部署

1. 打开 [vercel.com](https://vercel.com)
2. 用 GitHub 账号登录
3. 点击 **Add New Project**
4. 找到你的仓库，点击 **Import**

---

## 第三步：配置环境变量

在 Vercel 项目设置中，添加以下环境变量：

| 变量名 | 值 | 从哪里找 |
|--------|-----|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | 你的 Supabase URL | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 你的 anon/public key | Supabase Dashboard → Settings → API |

**获取方式：**
1. 打开 [supabase.com](https://supabase.com)
2. 进入你的项目
3. 左侧菜单 → **Settings → API**
4. 复制：
   - **URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

![截图位置](https://i.imgur.com/placeholder.png)

---

## 第四步：部署

1. 点击 **Deploy**
2. 等待 1-3 分钟构建完成
3. 获得你的域名，例如 `https://your-game.vercel.app`

---

## 第五步：验证部署

1. 打开部署的网址
2. 测试登录功能
3. 测试游戏功能

---

## 更新部署（代码修改后）

```bash
# 修改代码后
git add .
git commit -m "Update xxx"
git push

# Vercel 会自动重新部署
```

---

## 第六步：修改 APK 里的网址

1. 打开 `android-webview/app/src/main/java/com/textadventure/game/MainActivity.kt`
2. 修改第 40 行：

```kotlin
// 原来的
webView.loadUrl("http://192.168.1.100:3000")

// 改成你的 Vercel 地址
webView.loadUrl("https://your-game.vercel.app")
```

3. 保存，用 Android Studio 重新构建 APK

---

## 常见问题

### Q: 部署后登录不了？
- 检查环境变量是否正确配置
- 检查 Supabase 的 Authentication 设置
- 检查域名是否在 Supabase 的 Site URL 白名单中

### Q: 需要配置自定义域名吗？
- 不需要，vercel.app 的免费域名就可以用
- 如果想要自己的域名（如 game.yourname.com），在 Vercel Settings → Domains 添加

### Q: Supabase 免费额度够用吗？
- 个人使用完全够用
- 数据库：500MB 存储
- 流量：2GB 带宽
- 如果用户多可能需要升级

---

## 下一步

部署成功后，你将获得：
1. ✅ 一个公网可访问的游戏网址
2. ✅ 可以把这个网址发给任何人玩
3. ✅ 也可以做成 APK 安装到手机

**需要我帮你检查 GitHub 推送步骤吗？**
