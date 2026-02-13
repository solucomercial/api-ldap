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

# Copiar apenas o necessário do estágio anterior
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

# Segurança: Executar como utilizador não-root
USER node

EXPOSE 3001
CMD ["node", "dist/server.ts"]