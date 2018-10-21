const UglifyJSPlugin = require('uglifyjs-webpack-plugin')
const lmerge = require('lodash.merge')
const webpackconfig = require('./webpack-config')

module.exports = lmerge(webpackconfig, {
  mode: 'production',
  output: {
    'filename': 'spray-wrtc.bundle.min.js'
  },
  plugins: [
    new UglifyJSPlugin({
      sourceMap: true,
      uglifyOptions: {
        compress: true,
        mangle: true,
        keep_fnames: false
      }
    })
  ]
})
