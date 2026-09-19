FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/scanner/public ./dist/scanner/public
COPY --from=build /app/src/admin/views ./dist/admin/views
COPY --from=build /app/src/admin/public ./dist/admin/public

EXPOSE 3000
CMD ["node", "dist/index.js"]
