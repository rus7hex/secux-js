const webpack = require('webpack');

const definePluginConfig = new webpack.DefinePlugin({
    'process.env.SECUX_PLATFROM': JSON.stringify('service')
});

const nodepolyfillPlugin = new (require("node-polyfill-webpack-plugin"));


module.exports = {
    entry: "./src/update.js",
    output: {
        path: `${__dirname}/lib`,
        filename: 'update.js',
        libraryTarget: 'umd'
    },
    plugins: [definePluginConfig, nodepolyfillPlugin],
    mode: 'production',
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: 'ts-loader',
                exclude: /node_modules/
            }
        ]
    },
    resolve: {
        extensions: ['.ts', '.js'],
        fallback: {
            fs: false
        }
    },
    externals: {
        "react-native-logs": "react-native-logs",
        "threads": "threads",
        "@secux/transport": "@secux/transport"
    },
    experiments: {
        asyncWebAssembly: true
    },
    optimization: {
        minimize: true,
        removeAvailableModules: true,
    }
}
