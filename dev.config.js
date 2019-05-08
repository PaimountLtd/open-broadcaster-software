const merge = require('webpack-merge');
const baseConfig = require('./base.config.js');
const path = require('path');

const plugins = [];

// only makes sense with transpileOnly mode which is currently broken
// const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
// plugins.push(new ForkTsCheckerWebpackPlugin({ vue: true }))

module.exports = merge.smart(baseConfig, {
  entry: {
    renderer: './app/app.ts',
    updater: './updater/ui.js',
    'guest-api': './guest-api',
  },

  mode: 'development',
  devtool: 'cheap-module-source-map',
  watchOptions: { ignored: /node_modules/ },

  module: {
    rules: [
      {
        test: /\.ts$/,
        loader: 'ts-loader',
        options: {
          experimentalWatchApi: true,
          // transpileOnly: true,
        },
        exclude: /node_modules|vue\/src/
      },
      {
        test: /\.tsx$/,
        include: path.resolve(__dirname, 'app/components'),
        use: [
          { loader: 'babel-loader' },
          {
            loader: 'ts-loader',
            options: {
              appendTsxSuffixTo: [/\.vue$/],
              experimentalWatchApi: true,
              // transpileOnly: true,
            }
          }
        ],
        exclude: /node_modules/,
      },
    ]
  },

  plugins,
});
