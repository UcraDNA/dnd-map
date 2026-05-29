FROM node:20-alpine

WORKDIR /app

# Install server deps
COPY server/package.json ./server/
RUN cd server && npm install --production

# Install client deps and build
COPY client/package.json ./client/
RUN cd client && npm install

COPY client/ ./client/
RUN cd client && npm run build

COPY server/ ./server/

EXPOSE 3001
CMD ["node", "server/index.js"]
