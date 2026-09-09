# 使用 linux/arm64 建置，部署至 Ubuntu ARM 主機。
FROM node:24-alpine AS frontend
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
ENV VITE_API_BASE_URL=/api/
RUN npm run build

FROM node:24-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/ ./
COPY --from=frontend /frontend/dist ./public
ENV PORT=8080
USER node
EXPOSE 8080
CMD ["node", "bin/www.js"]
