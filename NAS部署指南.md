# 绿联云 NAS Docker 部署指南

## 石墨烯产业动态（石墨烯联盟CGIA）翻页电子书

---

## 📦 部署步骤

### 第1步：访问 NAS Web 管理界面
```
http://192.168.1.109:9999
```
登录你的绿联云账号

### 第2步：安装 Docker
- 进入 **应用中心** → 搜索 **Docker** → 安装
- 安装完成后打开 Docker 管理界面

### 第3步：上传项目文件到 NAS
1. 在文件管理中，在 NAS 根目录创建文件夹 `flipbook-cgia`
2. 将以下文件上传到 `flipbook-cgia/` 目录：
   - `Dockerfile`
   - `docker-compose.yml`
   - `server.js`
   - `package.json`
   - `package-lock.json`
   - `public/` 目录（整个文件夹）

### 第4步：启动容器

**方式A — 使用 docker-compose（推荐）**
1. Docker → 容器 → 创建 → 选择 `docker-compose`
2. 选择项目路径 `flipbook-cgia/`
3. 点击部署

**方式B — 使用命令行**
在 NAS 上开启 SSH（控制面板 → 终端与SSH），然后执行：
```bash
cd /共享路径/flipbook-cgia
docker compose up -d
```

### 第5步：验证部署
打开浏览器访问：
```
http://192.168.1.109:3456
```

---

## 🌍 外网访问配置（二选一）

### 方案A：绿联云自带远程访问（最简单）
绿联云 DXP 系列自带 DDNS 和远程访问功能：
- 打开绿联云 APP → 远程访问 → 开启
- 记下外网访问地址
- 在路由器中设置端口转发：**3456 → 192.168.1.109:3456**

### 方案B：Cloudflare Tunnel（更稳定）
在绿联云 Docker 中再运行一个 Cloudflare Tunnel 容器：
```yaml
  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: cloudflared
    restart: unless-stopped
    command: tunnel --no-autoupdate run --token YOUR_TOKEN_HERE
    network_mode: host
```
需先在 https://dash.cloudflare.com 注册免费账号并创建 Tunnel。

---

## 🛠️ 日常维护

```bash
# 查看日志
docker logs flipbook-cgia

# 重启服务
docker compose restart

# 更新部署
docker compose down && docker compose up -d --build

# 备份数据
cp -r /nas-data/flipbook-cgia/nas-data /备份位置/
```

---

## 📂 数据持久化

所有上传的 PDF 和封面图片都保存在 NAS 的 `flipbook-cgia/nas-data/` 目录中：
- `uploads/` — PDF 文件
- `data/covers/` — 封面缩略图
- `data/books.json` — 书架元数据

即使容器被删除重建，数据也不会丢失。
