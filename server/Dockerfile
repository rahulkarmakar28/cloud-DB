FROM node:20-alpine
WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

EXPOSE 3001

# Run migrations then start the server
CMD sh -c "npm run migrate && npm start"
