// const tf = require('@tensorflow/tfjs')
const tf = require('@tensorflow/tfjs-node-gpu')
// const tf = require('@tensorflow/tfjs-node')

const BLACK = 1
const WHITE = -1

let boardHistory = {}
let model

module.exports = {
  init,
  calculateNextMove,
}

async function init (board) {
  const { width, height } = board
  if (width !== 19 || height !== 19) {
    throw new Error('ai only knows how to play on 19x19')
  }
  // populate board history
  boardHistory[-1] = Array(8).fill().map(() => get_empty_board(width, height))
  boardHistory[1] = Array(8).fill().map(() => get_empty_board(width, height))
  // awaken the ai
  console.log('Loading Model...')
  model_url = 'file://./models/leelazero_js_output_40x256/model.json'
  model = await tf.loadLayersModel(model_url)
}

function calculateNextMove (board, player) {
  updateHistories(board)
  const { pass, move } = selectNextMove(board, player)
  // console.log('calculateNextMove', player, move)
  return { pass, move }
}

function selectNextMove (board, player) {
  const enemy = -player
  const selfBoard = boardHistory[player]
  const enemyBoard = boardHistory[enemy]
  const tf_self = tf.tensor(selfBoard)
  const tf_enemy = tf.tensor(enemyBoard)
  const tf_ones = tf.ones([1, board.width, board.width])
  const tf_zeros = tf.zeros([1, board.width, board.width])
  const tf_input = tf.concat([tf_self, tf_enemy, tf_zeros, tf_ones])
  const tf_input_transpose = tf.transpose(tf_input)
  const preds = model.predict(tf.expandDims(tf_input_transpose))
  const move_number = tf.argMax(preds[0], 1)
  const am_js = move_number.dataSync()
  const count_coord = am_js[0]
  const coord_i = (count_coord % board.width)
  const coord_j = Math.floor(count_coord / board.width)
  const pass = coord_j === board.width
  const move = [coord_j, coord_i]
  // const value_output = preds[1].dataSync()
  // const value_probability = (1.0 + Math.tanh(value_output)) / 2.0
  // console.log({vertex, value_probability})
  return { pass, move }
}


function updateHistories (board) {
  boardHistory[BLACK].pop()
  boardHistory[BLACK].unshift(get_mono_board(board.signMap, BLACK))
  boardHistory[WHITE].pop()
  boardHistory[WHITE].unshift(get_mono_board(board.signMap, WHITE))
}

function get_mono_board (stones, color) {
  const height = stones.length
  const width = stones[0].length
  var monoboard = get_empty_board(width, height);
  for(let i = 0; i < stones.length; i++){
    for( let j = 0; j < stones[i].length; j++){
      if( stones[i][j] === color){
        monoboard[i][j] = 1.0;
      }
    }
  }
  return monoboard;
}

function get_empty_board(width, height = width) {
  return new Array(height).fill().map(() => {
    return new Array(width).fill().map(() => 0.0)
  })
}
