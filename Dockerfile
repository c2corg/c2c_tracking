# build stage
FROM node:18-slim as build-stage
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init
WORKDIR /usr
COPY package*.json ./
COPY tsconfig.json ./
COPY src ./src
RUN npm ci
RUN npm run build

# production stage
FROM node:18-slim
ENV NODE_ENV production
COPY --from=build-stage /usr/bin/dumb-init /usr/bin/dumb-init
WORKDIR /usr/src/app
COPY --from=build-stage --chown=node:node /usr/package*.json ./
# because husky is not available without dev deps
RUN npm set-script prepare ""
RUN npm ci --omit=dev --fund=false
COPY --from=build-stage --chown=node:node /usr/dist .
EXPOSE 8080
USER node
CMD [ "dumb-init", "node", "index.js" ]
