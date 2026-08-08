FROM node:20-alpine

WORKDIR /app

# Copy package requirements and install dependencies
COPY package*.json ./
RUN npm install

# Copy application source and configurations
COPY . .

# Generate Prisma client for SQLite
RUN npx prisma generate

# Compile TypeScript
RUN npm run build

EXPOSE 5001

CMD ["npm", "start"]
