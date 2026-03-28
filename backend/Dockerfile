FROM node:20-alpine

WORKDIR /app

# Install deps first (cache layer)
COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 4000

CMD ["node", "src/index.js"]
