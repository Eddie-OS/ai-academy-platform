# 前端 + 反向代理镜像。前端构建产物作为静态资源打进 Nginx，因此不需要单独的前端容器。

FROM node:22-alpine AS build
WORKDIR /src
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci || npm install
COPY frontend/ ./
RUN npm run build

FROM nginx:1.27-alpine
COPY docker/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist /usr/share/nginx/html
EXPOSE 80
