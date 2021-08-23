const chalk = require('chalk')
const { createGame } = require('./game')
const leelaSmall = require('./ais/leelazero-10x128')
// const leelaBig = require('./ais/leelazero-40x256')
const randobot = require('./ais/randobot')
const { composeBot } = require('./ais/composeBot')

const colors = {
  '0': 'white',
  '1': 'red',
  '-1': 'blue',
}

// const halfDumbBot = composeBot([
//   [50, leelaSmall],
//   [50, randobot],
// ])
const halfDumbBot = composeBot([
  [80, leelaSmall],
  [20, randobot],
])

start()


async function start() {
  console.error('start')
  const history = []
  const game = createGame()
  await halfDumbBot.init(game.board)
  while (game.board.isValid() && game.takeTurn(halfDumbBot)) {
    // draw board
    history.push(serialize(game.board))
  }
  const scores = game.calculateScores()
  // console.log(`
  // captures:
  //   ${colors[ 1]}: ${scores[1].captures}
  //   ${colors[-1]}: ${scores[-1].captures}
  // `)
  console.log('export default '+JSON.stringify(history))
}

function serialize (board) {
  return board.signMap
  // const serializedBoard = { black: [], white: [] }
  // const ownerColors = { '1': 'black', '-1': 'white' }
  // for (const [yStr, row] of Object.entries(board.signMap)) {
  //   for (const [xStr, owner] of Object.entries(row)) {
  //     if (owner === 0) continue
  //     const pos = [Number(xStr), Number(yStr)]
  //     const color = ownerColors[owner]
  //     serializedBoard[color].push(pos)
  //   }
  // }
  // return serializedBoard
}

function renderBoard (board) {
  let output = ''
  // build liberties
  const libertyBoard = Array(board.height).fill().map(() => Array(board.width).fill())
  for (const [yStr, row] of Object.entries(board.signMap)) {
    for (const [xStr, owner] of Object.entries(row)) {
      const target = [Number(xStr), Number(yStr)]
      const [x, y] = target
      // if (owner === 0) continue
      const ownedNeighbors = board.getNeighbors(target)
        .map(v => board.get(v))
        .filter(o => o !== 0)
      const hasPos = ownedNeighbors.includes(1)
      const hasNeg = ownedNeighbors.includes(-1)
      const hasBoth = hasPos && hasNeg
      const hasNeither = !hasPos && !hasNeg
      const value = hasBoth ? 0
        : hasNeither ? undefined
        : hasPos ? 1
        : -1
      libertyBoard[y][x] = value
    }
  }
  // console.log(libertyBoard)
  // draw board
  // const xLabels = Array(board.width).fill().map((_, index) => `${index}`.padStart(2)).join('')
  const xLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.slice(0,board.width).split('').join(' ')
  output += `  ${xLabels}\n`
  for (const [yStr, row] of Object.entries(board.signMap)) {
    output += yStr.padStart(2)
    for (const [xStr, piece] of Object.entries(row)) {
      const liberty = libertyBoard[yStr][xStr]
      output += renderPiece(piece, liberty)
    }
    output += '\n'
  }
  console.log(output)
}

function renderPiece (piece, liberty) {
  // " ░▒▓█"
  // ▘▗ ▚ ▞
  // ▔▏
  const partial = '░░'
  const symbols = {
    '0': '  ',
    '-1': '██',
    '1': '██',
  }
  const partialColors = {
    '0': 'magenta',
    '1': 'red',
    '-1': 'blue',
  }
  if (piece === 0 && liberty !== undefined) {
    return chalk[partialColors[liberty]](partial)
  } else {
    return chalk[colors[piece]](symbols[piece])
  }
}

function timeout (duration) {
  return new Promise(resolve => setTimeout(resolve, duration))
}