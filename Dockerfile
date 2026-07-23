# Stage 1: Build
FROM node:20-alpine AS build

WORKDIR /app

# Copy root package files for workspace resolution
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/

# Install all dependencies (including devDependencies for build)
RUN npm install

# Copy source code
COPY tsconfig.json ./
COPY packages/shared/ packages/shared/
COPY packages/server/ packages/server/
COPY packages/client/ packages/client/

# Build shared types first (server and client depend on it)
RUN npm run build --workspace=packages/shared

# Build the client (Vite)
RUN npm run build --workspace=packages/client

# Build the server (tsc)
RUN npm run build --workspace=packages/server

# Stage 2: Runtime
FROM node:20-alpine AS runtime

WORKDIR /app

# Copy root package files for workspace resolution
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/

# Install production dependencies only
RUN npm install --omit=dev

# Copy built artifacts
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/server/dist packages/server/dist
COPY --from=build /app/packages/client/dist packages/client/dist

EXPOSE 3001

CMD ["node", "packages/server/dist/index.js"]
