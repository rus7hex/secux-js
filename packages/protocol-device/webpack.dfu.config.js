const webpack = require('webpack');

const definePluginConfig = new webpack.DefinePlugin({
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env.ENV': JSON.stringify('web')
})

const nodepolyfillPlugin = new (require("node-polyfill-webpack-plugin"));


module.exports = {
    entry: `${__dirname}/src/worker.ts`,
    output: {
        path: `${__dirname}/dist`,
        filename: 'worker.js',
        libraryTarget: 'commonjs'
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
        // don't need to import or require with .js
        extensions: ['.ts', '.js'],
        fallback: {
            fs: false
        }
    },
    experiments: {
        asyncWebAssembly: true
    },
    optimization: {
        minimize: true,
        removeAvailableModules: true,
    }
}
