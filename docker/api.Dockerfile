FROM node:20-slim AS base
WORKDIR /app

# Copy workspace root and shared
COPY package.json package-lock.json* ./
COPY packages/shared/ packages/shared/
COPY apps/api/ apps/api/

RUN npm install --workspace=packages/shared --workspace=apps/api
RUN npm run build --workspace=packages/shared

EXPOSE 3001

CMD ["npm", "run", "dev", "--workspace=apps/api"]
