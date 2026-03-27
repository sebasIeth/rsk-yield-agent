FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma/ ./prisma/
RUN npx prisma generate

COPY . .

RUN npm run build

ENV PORT=4000
EXPOSE 4000

CMD ["sh", "-c", "npx prisma db push --accept-data-loss && npm start -- -p 4000"]
