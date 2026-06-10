FROM node:24-alpine3.22
ENV NODE_ENV=production

WORKDIR /app
COPY . .

RUN npm install --omit=dev

CMD ["node", "./bin/www.js"]
