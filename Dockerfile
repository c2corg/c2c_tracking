# build stage
FROM node:18-alpine as build-stage
WORKDIR /usr
COPY package*.json ./
COPY tsconfig.json ./
COPY src ./src
RUN npm ci
RUN npm run build

# production stage
FROM node:18-alpine
WORKDIR /usr/src/app
COPY --from=build-stage /usr/package.json ./
ENV NODE_ENV production
# because of husky no available without dev deps
RUN npm set-script prepare ""
RUN npm install
COPY --from=build-stage /usr/dist .
EXPOSE 8080
CMD [ "node", "index.js" ]
