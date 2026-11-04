const path = require('path');
const webpack = require('webpack');
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { ESBuildMinifyPlugin } = require('esbuild-loader');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const WebpackBar = require('webpackbar');

const cwd = process.cwd();
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';
// MOCK=1 runs the view against an in-memory fake Base (no Lark login needed).
// It skips the opdev plugin/middleware, which require `opdev login`, app.json and block.json.
const isMock = process.env.MOCK === '1';

const larkUtils = isMock ? null : require('@lark-opdev/block-bitable-webpack-utils');
const publicPath = isDevelopment && !isMock ? '/block/' : isMock && isDevelopment ? '/' : './';

const config = {
  entry: './src/index.tsx',
  devtool: isProduction ? false : 'inline-source-map',
  mode: isDevelopment ? 'development' : 'production',
  stats: 'errors-warnings',
  // Tracing build dependencies through @lark-opdev/cli emits thousands of harmless cache
  // warnings ("doesn't lead to expected result") whenever a cache is created.
  infrastructureLogging: { level: 'error' },
  output: {
    path: path.resolve(__dirname, isMock ? '../dist-demo' : '../dist'),
    clean: true,
    publicPath,
  },
  module: {
    rules: [
      {
        oneOf: [
          {
            test: /\.[jt]sx?$/,
            include: [path.join(cwd, 'src')],
            exclude: /node_modules/,
            use: [
              {
                loader: require.resolve('esbuild-loader'),
                options: { loader: 'tsx', target: 'es2017' },
              },
            ],
          },
          {
            test: /\.css$/,
            use: [isDevelopment ? 'style-loader' : MiniCssExtractPlugin.loader, 'css-loader'],
          },
          {
            test: /\.(png|jpg|jpeg|gif|ico|svg)$/,
            type: 'asset/resource',
            generator: { filename: 'assets/[name][ext][query]' },
          },
        ],
      },
    ],
  },
  plugins: [
    ...(isDevelopment ? [new ReactRefreshWebpackPlugin(), new WebpackBar()] : [new MiniCssExtractPlugin()]),
    new webpack.DefinePlugin({
      'process.env.PV_MOCK': JSON.stringify(isMock ? '1' : ''),
    }),
    ...(larkUtils ? [new larkUtils.BitableAppWebpackPlugin({})] : []),
    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: './public/index.html',
      publicPath,
    }),
  ],
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  performance: { hints: false },
  optimization: {
    minimize: isProduction,
    minimizer: [new ESBuildMinifyPlugin({ target: 'es2017', css: true })],
    moduleIds: 'deterministic',
    runtimeChunk: true,
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: { name: 'vendor', test: /[\\/]node_modules[\\/]/, chunks: 'all' },
      },
    },
  },
  devServer: isProduction
    ? undefined
    : {
        hot: true,
        port: isMock ? 5180 : undefined,
        open: false,
        client: {
          logging: 'error',
          overlay: {
            errors: true,
            warnings: false,
            // Benign browser notice triggered by Semi's autosizing TextArea; not an app error.
            runtimeErrors: (error) => !/ResizeObserver loop/.test(error?.message || ''),
          },
        },
        setupMiddlewares: (middlewares, devServer) => {
          if (!devServer || !devServer.app) throw new Error('webpack-dev-server is not defined');
          if (larkUtils) middlewares.push(larkUtils.opdevMiddleware(devServer));
          return middlewares;
        },
      },
  cache: {
    type: 'filesystem',
    // One cache per target+mode: a production cache (MiniCssExtractPlugin entries) cannot be
    // restored by a development build and would flood the console with "Restoring failed".
    name: `${isMock ? 'mock' : 'lark'}-${isProduction ? 'production' : 'development'}`,
    buildDependencies: { config: [__filename] },
  },
};

module.exports = config;
