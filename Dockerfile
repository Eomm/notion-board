FROM node:18 AS build-env
COPY . .

# Install dependencies and build
RUN npm ci --omit=dev

FROM gcr.io/distroless/nodejs18-debian11
COPY --from=build-env . .

ENTRYPOINT [ "node" ]
CMD ["/index.js"]