const isBrowser = process.browser
const tf = isBrowser ? require('@tensorflow/tfjs') : require('@tensorflow/tfjs-node-gpu')

module.exports = {
  tf, loadModel
}

async function loadModel (modelPath) {
  const model_url = isBrowser ? `${location.origin}${modelPath}/model.json` : `file://${modelPath}/model.json`
  return await tf.loadLayersModel(model_url)
}