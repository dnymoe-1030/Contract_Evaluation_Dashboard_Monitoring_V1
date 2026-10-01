# Production Container for SM Contract Evaluation Dashboard
# Node.js + Express Backend Proxy with Google Sheets API (IAM Service Account)
FROM node:20-alpine

WORKDIR /app

# Copy package descriptors
COPY package*.json ./

# Install production dependencies
RUN npm install --omit=dev

# Copy application code and assets
COPY server.js ./
COPY index.html ./
COPY css/ ./css/
COPY js/ ./js/
COPY data/ ./data/
COPY SM_Dashboard_Standalone.html ./

EXPOSE 8080
ENV PORT=8080
ENV NODE_ENV=production

CMD ["node", "server.js"]
