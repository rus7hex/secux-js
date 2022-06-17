const webpack = require('webpack');


const definePluginConfig = new webpack.DefinePlugin({
    'process.env.SECUX_PLATFROM': JSON.stringify('service')
});

const nodepolyfillPlugin = new webpack.ProvidePlugin({
    process: 'process/browser',
    Buffer: ['buffer', 'Buffer'],
});


module.exports = {
    entry: {
        base: {
            import: './src/base.js',
        },
    },
    output: {
        path: `${__dirname}/lib`,
        filename: '[name].js',
        library: {
            type: 'umd'
        }
    },
    plugins: [nodepolyfillPlugin, definePluginConfig],
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
    externals: {
        "react-native-logs": "react-native-logs",
        "@secux/transport": "@secux/transport",
    },
    experiments: {
        asyncWebAssembly: true
    },
    optimization: {
        minimize: true,
        removeAvailableModules: true
    }
}
