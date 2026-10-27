// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite on web runs SQLite compiled to WebAssembly.
config.resolver.assetExts.push('wasm');

module.exports = config;
