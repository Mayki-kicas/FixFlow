# Dockerfile pour développement Next.js
FROM node:20-alpine

# Installer les dépendances système nécessaires pour Prisma
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Forcer l'environnement dev pour conserver toute la toolchain (tsx, eslint, etc.)
ENV NODE_ENV=development

# Copier les fichiers de dépendances
COPY package.json package-lock.json ./

# Installer toutes les dépendances (incluant devDependencies)
RUN npm ci --include=dev

# Copier le reste du code
COPY . .

# Exposer le port 3000
EXPOSE 3000

# Commande par défaut pour le développement
CMD ["npm", "run", "dev"]
