# MuSeeum Web - Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

ARG VITE_API_URL
ARG VITE_MUSEEUM_APP_ID
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_MUSEEUM_APP_ID=${VITE_MUSEEUM_APP_ID}

RUN npm run build

# MuSeeum Web - Serve stage (Cloud Run)
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

RUN npm install -g serve

COPY --from=builder /app/dist ./dist

EXPOSE 8080

CMD ["sh", "-c", "serve -s dist -l ${PORT:-8080}"]
