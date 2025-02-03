const path = require('path');
const { CopyPlugin } = require('copy-webpack-plugin'); // Ensure this line is correct

module.exports = {
    entry: './src/index.js',
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist')
    },
    plugins: [
        new CopyPlugin({
            patterns: [
                { from: 'models', to: 'models' } // Copy /models to dist/models
            ]
        })
    ],
    mode: 'production'
};