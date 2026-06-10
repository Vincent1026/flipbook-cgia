# 翻页电子书 Docker 部署 — 石墨烯产业动态（CGIA）
FROM node:22-alpine

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm install --production

# 复制应用代码
COPY public/ ./public/
COPY server.js ./

# 创建数据目录（运行时挂载为卷）
RUN mkdir -p /app/uploads /app/data/covers /app/wechat-verify

# 暴露端口
EXPOSE 3456

# 启动服务
ENV NODE_ENV=production
ENV PORT=3456
CMD ["node", "server.js"]
