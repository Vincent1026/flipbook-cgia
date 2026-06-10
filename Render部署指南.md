# Render.com 部署指南

## 第一步：注册 Render 账号

打开 https://render.com → 点击 **"Get Started for Free"** → 使用 GitHub 账号一键登录

## 第二步：部署 Web Service

1. 登录后点击 **"New +"** → 选择 **"Web Service"**
2. 连接 GitHub 账号 → 找到仓库 `flipbook-cgia`
3. 配置选项（Render 会自动识别 `render.yaml`）：
   - **Name**: `flipbook-cgia`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
4. 点击 **"Create Web Service"**

## 第三步：等待部署完成

部署大约需要 2-3 分钟。完成后您将获得永久域名：
```
https://flipbook-cgia.onrender.com
```

## ⚠️ 重要限制说明

**Render 免费版不支持持久化磁盘。**

这意味着：
- ✅ 书架界面、翻页阅读器 → 正常工作
- ✅ 任何人可以上传 PDF → 暂时可用
- ❌ **上传的 PDF 文件在服务器重启/重新部署后会丢失**
- ❌ **书架数据（books.json）也会被重置**

### 解决方案（后续可选）

| 方案 | 说明 |
|------|------|
| **A. 本地为主** | 主要在本机运行，Render 仅用于展示 |
| **B. Cloudinary 云存储** | 将 PDF 和封面上传到 Cloudinary（免费额度 25GB） |
| **C. MongoDB Atlas** | 用云数据库存储书架元数据 |
| **D. 升级到 Render Pro** | $7/月 获得持久化磁盘 |

## 第四步：配置公众号菜单

部署成功后，在公众号后台配置菜单：
- 菜单名称：`📚 产业动态`
- 类型：跳转网页
- 地址：`https://flipbook-cgia.onrender.com`
