# build stage
FROM node:26-slim AS build-stage
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init
WORKDIR /usr
COPY package*.json ./
RUN npm ci --fund=false
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY scripts ./scripts
RUN npm run build
RUN npm prune --omit=dev

# production stage
FROM node:26-slim
ARG version
ENV npm_package_version=${version}
ENV NODE_ENV=production
COPY --from=build-stage /usr/bin/dumb-init /usr/bin/dumb-init
WORKDIR /usr/src/app
COPY --from=build-stage --chown=node:node /usr/package.json ./
COPY --from=build-stage --chown=node:node /usr/node_modules ./node_modules
# dist/src and dist/scripts: the scripts run with `node scripts/<script>.js`
COPY --from=build-stage --chown=node:node /usr/dist ./
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
ENV PORT=8080
ENV METRICS_PORT=8081
EXPOSE 8080 8081
# no curl in the slim image: Node checks the health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://localhost:' + process.env.PORT + '/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
ENTRYPOINT [ "docker-entrypoint.sh" ]
CMD [ "dumb-init", "node", "src/index.js" ]
