const path = require('path');
const webpack = require('webpack');
const Dotenv = require('dotenv-webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CopyWebpackPlugin } = require('copy-webpack-plugin');

module.exports = {
    entry: './src/index.js', // Adjust based on your project structure
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist')
    },
    plugins: [
        new Dotenv(),
        new webpack.DefinePlugin({
            'process.env.MY_GOOGLE_API_KEY': JSON.stringify(process.env.MY_GOOGLE_API_KEY)
        }),
        new HtmlWebpackPlugin({
            template: './index.html', // Path to your HTML template
            filename: 'index.html' // Output file name
        }),
        new CopyWebpackPlugin({
            patterns: [
                { from: 'models', to: 'models' } // Copy /models to dist/models
            ]
        })
    ],
    mode: process.env.NODE_ENV || 'development'
};