# Stage 1: Build static client-side bundle
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Serve static assets via Nginx configured for Google Cloud Run
FROM nginx:1.27-alpine AS runner
ENV PORT=8080

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
