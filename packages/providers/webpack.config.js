const webpack = require('webpack');

const nodepolyfillPlugin = new webpack.ProvidePlugin({
    process: 'process/browser',
    Buffer: ['buffer', 'Buffer'],
});

module.exports = {
    entry: "./src/index.ts",
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
            buffer: require.resolve('buffer/'),
            process: require.resolve('process'),
            fs: false,
            os: false,
            path: false,
            stream: false,
        }
    },
    externals: {
        "react-native-logs": "react-native-logs"
    },
    experiments: {
        asyncWebAssembly: true
    },
    optimization: {
        minimize: true,
        removeAvailableModules: true,
    }
}
