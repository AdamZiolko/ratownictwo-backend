# 1. Bazowy obraz Node
FROM node:18-alpine

# 2. Katalog roboczy w kontenerze
WORKDIR /app

# 3. Skopiuj tylko manifesty i zainstaluj zależności
COPY package.json package-lock.json ./
RUN npm ci --production

# 4. Skopiuj resztę Twojego kodu
COPY . .

# 5. Otwórz port (ten sam co w docker-compose)
EXPOSE 8080

# 6. Komenda startowa uruchamiająca Twój server.js
CMD ["node", "server.js"]
