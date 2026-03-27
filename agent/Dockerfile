FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

ENV AGENT_PORT=4001
EXPOSE 4001

CMD ["node", "dist/index.js"]
