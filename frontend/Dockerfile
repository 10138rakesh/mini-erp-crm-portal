FROM node:20-alpine

WORKDIR /app

# Copy package requirements and install dependencies
COPY package*.json ./
RUN npm install

# Copy application source and build client
COPY . .
RUN npm run build

# Install a simple static server package to host built static content
RUN npm install -g serve

EXPOSE 5173

CMD ["serve", "-s", "dist", "-l", "5173"]
