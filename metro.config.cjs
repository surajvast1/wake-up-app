const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push("lottie");

/** Metro must listen on all interfaces when running inside Docker. */
if (process.env.DOCKER === "1") {
  config.server = {
    ...config.server,
    host: "0.0.0.0",
  };
}

module.exports = config;
