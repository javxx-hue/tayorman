# ==========================================
# 1. Base Build Stage
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json ./

# Install dependencies cleanly
RUN npm ci

# Pass build-time environment arguments (Vite bakes these into JS)
ARG VITE_SUPABASE_URL=""
ARG VITE_SUPABASE_ANON_KEY=""
ARG VITE_TELEGRAM_BOT="sessiyagatayyorlanbot"
# The "Admin Panel" link in admins' profile (empty = no link)
ARG VITE_ADMIN_URL=""
# Where the admin site is served from: /admin/ behind the main domain, / when it has a port or domain of its own
ARG ADMIN_BASE="/admin/"

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_TELEGRAM_BOT=$VITE_TELEGRAM_BOT
ENV VITE_ADMIN_URL=$VITE_ADMIN_URL
ENV ADMIN_BASE=$ADMIN_BASE

# Copy source code
COPY . .

# Build production assets for both student Mini App and Admin Web
RUN npm run build && npm run build:admin

# ==========================================
# 2. Production Stage - Student Mini App
# ==========================================
FROM nginx:1.27-alpine AS web

RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx/spa.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

# ==========================================
# 3. Production Stage - Admin Web Panel
# ==========================================
FROM nginx:1.27-alpine AS admin

RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /app/dist-admin /usr/share/nginx/html
COPY nginx/admin-spa.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

# Default target is web
FROM web AS final
