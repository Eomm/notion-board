FROM node:18 AS build-env
COPY . .

# Install dependencies and build
RUN npm ci

FROM gcr.io/distroless/nodejs18-debian11
COPY --from=build-env . .
COPY entrypoint.sh /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]