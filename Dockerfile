# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY package.json ./
COPY frontend/package.json ./frontend/
RUN npm install -w frontend
COPY frontend/ ./frontend/
RUN npm run build -w frontend

# Stage 2: Build backend
FROM node:20-alpine AS backend-build
WORKDIR /app
COPY package.json ./
COPY backend/package.json ./backend/
RUN npm install -w backend
COPY backend/ ./backend/
RUN npm run build -w backend

# Stage 3: Production runtime
FROM node:20-alpine
WORKDIR /app

# Copy backend production dependencies
COPY package.json ./
COPY backend/package.json ./backend/
RUN npm install -w backend --omit=dev

# Copy compiled backend
COPY --from=backend-build /app/backend/dist ./backend/dist

# Copy built frontend as static files
COPY --from=frontend-build /app/frontend/dist ./public

EXPOSE 3000
CMD ["node", "backend/dist/index.js"]
