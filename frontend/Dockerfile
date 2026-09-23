# Frontend service image (Next.js). Used by the root docker-compose.yml.
FROM node:20-slim

ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3001
CMD ["npm", "run", "start", "--", "-p", "3001"]
