const UglifyJSPlugin = require('uglifyjs-webpack-plugin')
const lmerge = require('lodash.merge')
const webpackconfig = require('./webpack-config')

module.exports = lmerge(webpackconfig, {
  mode: 'production',
  output: {
    'filename': 'spray-wrtc.bundle.min.js'
  },
  optimization: {
    minimizer: [new UglifyJSPlugin({
      sourceMap: false,
      parallel: true,
      uglifyOptions: {
        warnings: false,
        parse: {},
        compress: {},
        mangle: true, // Note `mangle.properties` is `false` by default.
        output: {
          comments: false
        },
        toplevel: false,
        nameCache: null,
        ie8: false,
        keep_fnames: false
      }
    })]
  }
})
