const webpack = require('webpack');

const nodepolyfillPlugin = new webpack.ProvidePlugin({
    process: 'process/browser',
    Buffer: ['buffer', 'Buffer'],
});


module.exports = {
    entry: "./src/transport-virtual.ts",
    output: {
        path: `${__dirname}/dist`,
        filename: 'index.js',
        library: {
            type: 'umd'
        }
    },
    plugins: [nodepolyfillPlugin],
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
            fs: false,
            path: require.resolve("path-browserify"),
        }
    },
    externals: {
        "tiny-secp256k1": "tiny-secp256k1",
        "@secux/transport": "@secux/transport",
        "@secux/utility": "@secux/utility",
        "ow": "ow"
    },
    experiments: {
        asyncWebAssembly: true,
    },
    optimization: {
        minimize: true,
        removeAvailableModules: true,
    }
}
