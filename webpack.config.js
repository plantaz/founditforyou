const path = require('path');
const webpack = require('webpack');
const Dotenv = require('dotenv-webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    entry: './src/index.js', // Adjust based on your project structure
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist')
    },
    plugins: [
        new Dotenv(),
        new webpack.DefinePlugin({
            'process.env': JSON.stringify({
                AWS_ACCESS_KEY: JSON.stringify(process.env.MY_AWS_ACCESS_KEY_ID),
                AWS_SECRET_ACCESS: JSON.stringify(process.env.MY_AWS_SECRET_ACCESS_KEY),
                AWS_REGION: JSON.stringify(process.env.MY_AWS_REGION),
                GOOGLE_API_KEY: JSON.stringify(process.env.MY_GOOGLE_API_KEY),
                NODE_ENV: JSON.stringify(process.env.NODE_ENV)
            })
        }),
        new HtmlWebpackPlugin({
            template: './index.html', // Path to your HTML template
            filename: 'index.html' // Output file name
        })
    ],
    mode: process.env.NODE_ENV || 'development'
};