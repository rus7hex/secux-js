module.exports = {
    entry: "./src/utility.ts",
    output: {
        path: `${__dirname}/lib`,
        filename: 'utility.js',
        library: {
            type: 'umd'
        }
    },
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
    },
    externals: {
        "@secux/transport": "@secux/transport",
        "ow": "ow",
        "react-native-logs": "react-native-logs",
    },
    experiments: {
        asyncWebAssembly: true
    },
    optimization: {
        minimize: true,
    }
}
