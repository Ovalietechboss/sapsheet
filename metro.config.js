const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Fix for Windows path issues with node:sea
config.resolver.blockList = [
  /^.*\/\.expo\/metro\/externals\/node:sea.*$/,
];

module.exports = config;
