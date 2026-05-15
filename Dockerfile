# ─────────────────────────────────────────────
# easy-point-api  ·  Development image
# Mirrors: pnpm start:dev  (nest start --watch)
# ─────────────────────────────────────────────
FROM node:22-alpine

# Herramientas necesarias para compilar módulos nativos (argon2, msgpackr-extract, etc.)
RUN apk add --no-cache python3 make g++

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy manifests first for layer caching
COPY package.json pnpm-lock.yaml ./

# Paso 1: instalar dependencias SIN ejecutar build scripts
# Esto evita el ERR_PNPM_IGNORED_BUILDS de pnpm v10
RUN pnpm install --frozen-lockfile --ignore-scripts

# Paso 2: recompilar módulos nativos explícitamente (argon2, msgpackr-extract, unrs-resolver)
# pnpm rebuild no está sujeto al onlyBuiltDependencies check
RUN pnpm rebuild

# Copy the full source (node_modules excluded via .dockerignore)
COPY . .

EXPOSE 3001

# prisma generate se ejecuta en runtime (cuando env_file ya está disponible)
# porque prisma.config.ts llama env('DIRECT_URL') que solo existe en tiempo de ejecución
CMD sh -c "pnpm exec prisma generate --schema=./prisma/schema.prisma && pnpm run start:dev"
