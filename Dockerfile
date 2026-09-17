# build stage
FROM node:24-slim as build-stage
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init
WORKDIR /usr
COPY package*.json ./
RUN npm ci --fund=false
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
RUN npm run build
RUN npm prune --omit=dev

# production stage
FROM node:24-slim
ARG version
ENV npm_package_version=${version}
ENV NODE_ENV production
COPY --from=build-stage /usr/bin/dumb-init /usr/bin/dumb-init
WORKDIR /usr/src/app
COPY --from=build-stage --chown=node:node /usr/package.json ./
COPY --from=build-stage --chown=node:node /usr/node_modules ./node_modules
COPY --from=build-stage --chown=node:node /usr/dist ./
COPY --from=build-stage --chown=node:node /usr/scripts ./scripts
COPY --from=build-stage --chown=node:node /usr/tsconfig.json ./tsconfig.json
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
ENV PORT 8080
ENV METRICS_PORT 8081
EXPOSE 8080 8081
ENTRYPOINT [ "docker-entrypoint.sh" ]
CMD [ "dumb-init", "node", "index.js" ]
