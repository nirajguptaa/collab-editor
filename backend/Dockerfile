FROM node:20-alpine

# Install Docker CLI so the backend can spawn execution containers
RUN apk add --no-cache docker-cli

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 4000

CMD ["node", "src/index.js"]