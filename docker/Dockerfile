FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
# --include=dev fuerza a instalar devDependencies (ej. typescript) sin importar
# si NODE_ENV=production llega inyectado como build arg (Coolify inyecta las
# env vars de la app como ARG/ENV de build automáticamente).
RUN npm ci --include=dev
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache curl
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
# TODO: sumar acá los estáticos de admin/scanner (views, public) cuando esas
# fases del roadmap agreguen esos directorios (todavía no existen en Fase 1).

EXPOSE 3000
CMD ["node", "dist/index.js"]
