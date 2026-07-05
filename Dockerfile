# Stage 1: Build the application
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency configuration files
COPY package*.json ./

# Install all dependencies (including devDependencies for the build phase)
RUN npm ci

# Copy the rest of the application source code and data files
COPY . .

# Run the build script (compiles frontend assets and bundles server.ts to dist/server.cjs)
RUN npm run build

# Stage 2: Production environment
FROM node:22-alpine AS runner

WORKDIR /app

# Set runtime environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Copy package configuration files and install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled dist files and data directory from the builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/data ./data

# Expose port 3000
EXPOSE 3000

# Start the application using our production command
CMD ["npm", "start"]
