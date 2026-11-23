# --- 构建阶段 ---
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# 安装原生 C++ 构建依赖 (better-sqlite3 所需)
RUN apt-get update && apt-get install -y python3 make g++ git && rm -rf /var/lib/apt/lists/*

# 复制 workspace package.json
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
COPY packages/web/package.json ./packages/web/

# 安装依赖
RUN npm install

# 复制源代码并执行全栈编译 (shared -> server -> web)
COPY . .
RUN npm run build

# --- 生产运行阶段 ---
FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data

# 暴露数据卷与端口
VOLUME ["/data"]
EXPOSE 3000

# 复制全部就绪产物
COPY --from=builder /app /app

# 启动服务
CMD ["node", "packages/server/dist/index.js"]
