FROM node:22-alpine
RUN apk add --no-cache docker-cli
WORKDIR /app
COPY package.json server.js ./
COPY public ./public
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.js"]
