const { createLeela } = require('./createLeela')

module.exports = createLeela({
  modelPath: `${__dirname}/models/leelazero_js_output_10x128`
})