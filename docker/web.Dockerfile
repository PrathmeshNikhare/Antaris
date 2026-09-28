FROM node:20-slim AS base
WORKDIR /app

# Copy workspace root and shared
COPY package.json package-lock.json* ./
COPY packages/shared/ packages/shared/
COPY apps/web/ apps/web/

RUN npm install --workspace=packages/shared --workspace=apps/web
RUN npm run build --workspace=packages/shared

EXPOSE 5173

CMD ["npm", "run", "dev", "--workspace=apps/web", "--", "--host"]
