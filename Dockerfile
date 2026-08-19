# Dev image for Expo web (used by docker compose). Native Expo Go flows are easier on the host.
FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g yarn@1.22.22

COPY package.json yarn.lock ./

ENV DOCKER=1

RUN yarn install --frozen-lockfile

COPY . .

EXPOSE 8081

CMD ["sh", "-c", "yarn install && npx expo start --web --lan"]
