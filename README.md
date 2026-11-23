# 🌤️ 初晴笔记 (ChuQing Note)

> **雨过初晴，万卷归简。**  
> 一款专为 NAS 与私有云打造的现代化、离线优先富文本知识库系统。彻底告别繁琐的 Markdown 语法记忆，所见即所得，支持任意格式附件拖入与流式预览。

[![GitHub Release](https://img.shields.io/github/v/release/sbitoh/chuqing-note?color=0284c7&label=Release)](https://github.com/sbitoh/chuqing-note/releases/latest)
[![Android APK](https://img.shields.io/badge/Android-APK%20Download-34d399?logo=android&logoColor=white)](https://github.com/sbitoh/chuqing-note/releases/latest/download/chuqing-note-v1.0.0.apk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

### 📱 客户端直接下载 (Download APK)

无需从源码编译，直接点击下方链接下载安装包即可在安卓手机或平板上使用：

| 客户端平台 | 版本 | 安装包直接下载 | 说明 |
| :--- | :--- | :--- | :--- |
| **Android 原生客户端** | `v1.0.0` | [👉 **立即下载 chuqing-note-v1.0.0.apk (23.8 MB)**](https://github.com/sbitoh/chuqing-note/releases/latest/download/chuqing-note-v1.0.0.apk) | 支持 Android 8.0+ 手机 / 平板，附带开箱即用连接向导 |

> 💡 **使用说明**：安卓手机安装 APK 后首次启动，跟随引导填写您的 NAS / 私有服务器接入地址（外网域名或内网 IP 均可），点击连接即可开始同步书写。

---

## ✨ 核心特性

* **📝 纯粹的所见即所得（Zero-Markdown WYSIWYG）**：
  * 基于现代化 Tiptap / ProseMirror 内核，无需记忆任何排版语法符号。
  * 原生支持标题分级、粗斜下划、高亮、色彩、引用块、代码块、交互式待办复选列表与动态表格。
* **📎 万能附件（Universal File Capsule）**：
  * **附件支持**：无论是 PDF、Word、Excel、PPT、ZIP 压缩包，还是音频、视频、图片、CAD 文件，直接拖入光标处。
  * **智能卡片展示**：图片与音视频内联播放，PDF 弹窗即时预览，办公文档与压缩包一键本地下载。
* **💾 NAS 数据主权与物理去重**：
  * 数据库采用 **SQLite (WAL 模式)**，轻量极速，日常内存占用极低。
  * 附件存储引擎基于 **SHA-256 哈希去重**，重复上传大文件不额外消耗 NAS 硬盘空间。
  * 备份只需拷贝单个 `.db` 文件与附件存储目录，杜绝供应商锁定。
* **📱 全端同构 (Web + Android)**：
  * Web 端自适应桌面、平板与移动端浏览器。
  * Android 客户端基于 Capacitor 打包，100% 共享相同的富文本内核与附件卡片组件。
* **🐳 一键 Docker 部署**：
  * 提供轻量多阶段构建 Dockerfile 与 `docker-compose.yml`，开箱即用，完美接入 Lucky / Nginx 反向代理。

---

## 🏗️ 系统架构

```
┌────────────────────────────────────────────────────────┐
│                        客户端                          │
│   [ 网页端 (Web SPA) ]       [ 安卓端 (Capacitor APK) ]  │
│        (Vue 3 + Tiptap 2 + Tailwind CSS + Lucide)      │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTPS / RESTful API
                           ▼
┌────────────────────────────────────────────────────────┐
│                     反向代理接入层                      │
│            OpenWrt / Lucky / Nginx 反向代理            │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│             NAS 服务端 (Fastify + TypeScript)           │
│  ┌───────────────────────┐  ┌────────────────────────┐ │
│  │ 笔记 / 目录 / 增量同步 │  │ 附件流式上传与去重引擎 │ │
│  └───────────┬───────────┘  └───────────┬────────────┘ │
└──────────────┼──────────────────────────┼──────────────┘
               ▼                          ▼
      [ SQLite (WAL 模式) ]     [ NAS 物理附件存储池 ]
         chuqing.db              /storage/files/YYYY/MM/
```

---

## 🚀 快速开始

### 方式一：Docker Compose 一键启动（推荐）

1. **克隆仓库**：
   ```bash
   git clone https://github.com/sbitoh/chuqing-note.git
   cd chuqing-note
   ```

2. **启动服务**：
   ```bash
   docker compose up -d
   ```

3. **访问服务**：
   在浏览器打开 `http://<你的NAS_IP>:3000` 即可开始书写。

### 方式二：本地研发与运行

需要 Node.js 20+ 环境：

```bash
# 1. 安装项目全部依赖
npm install

# 2. 编译共享类型库
npm run build:shared

# 3. 启动服务端 (监听 3000 端口)
npm run dev:server

# 4. 启动前端 Vite 调试热更新 (监听 5173 端口)
npm run dev:web
```

---

## 📱 安卓客户端 (Android APK)

> 💡 **普通用户推荐直接下载**：如无需二次开发，请直接点击下载官方预编译好的 [📥 chuqing-note-v1.0.0.apk (23.8 MB)](https://github.com/sbitoh/chuqing-note/releases/latest/download/chuqing-note-v1.0.0.apk) 即可安装使用。

### 开发者二次开发与本地编译
本项目通过 Capacitor 将 Web 前端封装为原生 Android 应用：

1. **打包前端静态产物**：
   ```bash
   npm run build:web
   ```

2. **初始化与同步原生工程**：
   ```bash
   cd packages/android
   npm install
   npx cap add android
   npx cap sync android
   ```

3. **构建安装包**：
   * 在 Android Studio 中打开 `packages/android/android` 目录。
   * 点击 `Build` -> `Build Bundle(s) / APK(s)` -> `Build APK(s)` 即可生成可在手机安装的 `.apk` 文件。

---

## 🌐 反向代理与公网访问 (NAS 用户)

若你在 NAS 上使用 Lucky 或 Nginx 反代：
1. **反代配置**：
   * 监听规则：`https://notes.<你的域名>:10000`
   * 后端目标：`http://127.0.0.1:3000`
2. **大文件上传支持**：
   * 在反向代理与前端负载中，确保 `client_max_body_size` 设为 `500M` 以上，以保障大附件与视频顺畅上传。

---

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 开源发布。欢迎提 Issue 与 Pull Request！
