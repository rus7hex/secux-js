const OriginalResolver = require("metro-resolver");
const path = require('path');

const extraNodeModules = {
    "@babel/runtime": path.resolve(__dirname, 'node_modules/@babel/runtime'),
    "react-native": require.resolve('react-native'),
    "react-native-ble-plx": require.resolve('react-native-ble-plx'),
    "react-native-settings": require.resolve('react-native-settings'),
    "ow": require.resolve('ow'),
    "bignumber.js": path.resolve(__dirname, 'node_modules/bignumber.js'),
    "hash.js": require.resolve('hash.js'),
    "elliptic": require.resolve('elliptic'),
    "groestl-hash-js": require.resolve('groestl-hash-js'),
    "base-x": require.resolve('base-x'),
    "process": path.resolve('node_modules/process'),
    "base64-js": require.resolve('base64-js'),
    "ieee754": require.resolve('ieee754'),
    "crypto": require.resolve('react-native-crypto'),
    "js-sha3": require.resolve('js-sha3'),
    "secp256k1": path.resolve('node_modules/secp256k1'),
    "eth-sig-util": path.resolve('node_modules/eth-sig-util'),
    "wallet-address-validator": require.resolve('wallet-address-validator'),
    "@ethersproject/abi": require.resolve("@ethersproject/abi"),
    "rlp": require.resolve('rlp'),
    "os": require.resolve('react-native-os'),
    "fs": require.resolve('react-native-fs'),
    "stream": require.resolve('stream-browserify'),
    "path": require.resolve('path-browserify'),
    "zlib": require.resolve('browserify-zlib'),
    "http": require.resolve('@tradle/react-native-http'),
    "https": require.resolve('https-browserify'),
};

const watchFolders = [
    path.resolve(__dirname, 'node_modules'),
    path.resolve(__dirname, '../packages'),
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