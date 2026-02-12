# Estágio de Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Estágio de Produção
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
RUN npm install --only=production

EXPOSE 3001
CMD ["node", "dist/server.ts"]