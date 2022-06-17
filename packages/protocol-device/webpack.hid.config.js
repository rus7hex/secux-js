const webpack = require('webpack');

const definePluginConfig = new webpack.DefinePlugin({
    'process.env.ENV': JSON.stringify('web'),
    'process.env.DISTRIBUTION': JSON.stringify('development'),
    'process.env.LOGGER': JSON.stringify('winston')
});

const nodepolyfillPlugin = new (require("node-polyfill-webpack-plugin"));


module.exports = {
    entry: {
        index: './__tests__/hid.js',
        worker: './src/worker.ts',
    },
    output: {
        path: `${__dirname}/__tests__`,
        filename: '[name].js',
        libraryTarget: 'umd'
    },
    devServer: {
        compress: true,
        port: 8080,
        static: './__tests__'
    },
    devtool: 'inline-source-map',
    plugins: [definePluginConfig, nodepolyfillPlugin],
    mode: 'development',
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: 'ts-loader',
                exclude: /node_modules/
            }
        ]
    },
    externals: {
        "react-native-logs": "react-native-logs"
    },
    resolve: {
        // don't need to import or require with .js
        extensions: ['.ts', '.js'],
        alias: {
            fs: false,
            tls: false,
            net: false
        }
    },
    experiments: {
        asyncWebAssembly: true
    }
}
