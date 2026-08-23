# FireCheck — imagem para Coolify.
#
# O frontend Vite precisa das variáveis VITE_* em tempo de BUILD: elas são
# embutidas no bundle, não lidas em runtime. Por isso vêm como build args.
# As demais (banco, JWT, Firebase, Gemini, Cakto, Evolution) são lidas em
# runtime pelo servidor e devem ser configuradas no Coolify, não aqui.

# ── Estágio 1: build do frontend ──
FROM node:22-alpine AS build

WORKDIR /app

# Instala dependências primeiro para aproveitar o cache de camadas.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Embutidas no bundle durante o build.
ARG VITE_API_URL=""
ARG VITE_GEMINI_API_KEY=""
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_GEMINI_API_KEY=$VITE_GEMINI_API_KEY

RUN npm run build

# ── Estágio 2: runtime ──
FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

# Apenas as dependências de produção — o toolchain do Vite não vai para a imagem.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# O build pronto e o código que roda em runtime.
COPY --from=build /app/dist ./dist
COPY api ./api
COPY server.js ./

# Não roda como root.
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
