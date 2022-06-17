const OriginalResolver = require("metro-resolver");
const path = require('path');

const extraNodeModules = {
    "@babel/runtime": path.resolve(__dirname, 'node_modules/@babel/runtime'),
    "react-native": path.resolve(__dirname, 'node_modules/react-native'),
    "os": require.resolve('react-native-os'),
    "fs": require.resolve('react-native-fs'),
    "stream": require.resolve('stream-browserify'),
    "path": require.resolve('path-browserify'),
    "zlib": require.resolve('browserify-zlib'),
    "http": require.resolve('@tradle/react-native-http'),
    "https": require.resolve('https-browserify'),
    
    // app-btc
    "crypto": require.resolve('react-native-crypto'),

    // app-xrp
    "ws": require.resolve('websocket'),
};

const watchFolders = [
    path.resolve(__dirname, 'node_modules'),
    path.resolve(__dirname, '../packages'),
    path.resolve(__dirname, '../node_modules'),
];

const blacklistedModules = [
    "net", "tls"
];

module.exports = {
    resolver: {
        extraNodeModules,
        resolveRequest: (context, moduleName, platform) => {
            if (blacklistedModules.includes(moduleName)) {
                return {
                    filePath: path.resolve(__dirname, "shim-module.js"),
                    type: "sourceFile"
                };
            } else {
                return OriginalResolver.resolve(
                    { ...context, resolveRequest: undefined },
                    moduleName,
                    platform
                );
            }
        }
    },
    watchFolders
};