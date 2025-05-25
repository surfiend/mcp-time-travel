FROM node:22.12-alpine AS builder

# Install git for checkpoint operations
RUN apk add --no-cache git

COPY . /app
WORKDIR /app

RUN --mount=type=cache,target=/root/.npm npm install
RUN npm run build

FROM node:22-alpine AS release

# Install git for checkpoint operations
RUN apk add --no-cache git

COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/package-lock.json /app/package-lock.json

ENV NODE_ENV=production

WORKDIR /app

RUN npm ci --ignore-scripts --omit-dev

# Set default environment variables
ENV CHECKPOINT_STORAGE_PATH=/app/checkpoints
ENV CHECKPOINT_WORKSPACE_PATH=/workspace

# Create directories for checkpoint storage and workspace
RUN mkdir -p /app/checkpoints /workspace

ENTRYPOINT ["node", "dist/index.js"]