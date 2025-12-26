FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application (SvelteKit outputs to .svelte-kit for SSR, but we'll use static adapter)
# Note: For static deployment, configure adapter-static in svelte.config.js
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install serve to run the built app
RUN npm install -g serve

# Copy built files from builder
# SvelteKit static adapter outputs to 'build' directory
COPY --from=builder /app/build ./build

# Expose port
EXPOSE 3000

# Start the server
CMD ["serve", "-s", "build", "-l", "3000"]

