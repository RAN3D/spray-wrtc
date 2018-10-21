module.exports = {
  mode: 'development',
  entry: './lib/spray.js',
  output: {
    'path': require('path').resolve(process.cwd(), './bin'),
    'filename': 'spray-wrtc.bundle.js',
    'library': 'spray',
    'libraryTarget': 'umd',
    'umdNamedDefine': true
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: (name) => {
          return true
        },
        use: {
          loader: 'babel-loader',
          options: {
            presets: [ 'env' ]
          }
        }
      }
    ]
  },
  devtool: 'source-map'
}
