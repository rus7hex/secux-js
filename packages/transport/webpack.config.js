const webpack = require('webpack');


const nodepolyfillPlugin = new webpack.ProvidePlugin({
    process: 'process/browser',
    Buffer: ['buffer', 'Buffer'],
});

module.exports = {
    entry: "./polyfill.js",
    output: {
        path: `${__dirname}/lib`,
        filename: 'ITransport.js',
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
            buffer: require.resolve('buffer/'),
            process: require.resolve('process'),
            fs: false,
            os: false,
            path: false,
            stream: false
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
