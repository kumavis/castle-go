// patch for browserify
const util = require('util')
util.promisify = util.promisify || require('util-promisify')

const Board = require('@sabaki/go-board')
const chalk = require('chalk')
// const leelaBig = require('./ais/leelazero-40x256')
const leelaSmall = require('./ais/leelazero-10x128')
const randobot = require('./ais/randobot')
const { composeBot } = require('./ais/composeBot')

let board = Board.fromDimensions(19)
let currentPlayer = 1
let previousTurnDidPass = false
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
  await halfDumbBot.init(board)
  while (board.isValid() && takeTurn(halfDumbBot)) {
    // await timeout(1000)
  }
  const scores = calculateScores()
  console.log(`
  captures:
    ${colors[ 1]}: ${scores[1].captures}
    ${colors[-1]}: ${scores[-1].captures}
  `)
}

function calculateScores () {
  return {
    '1': {
      captures: board.getCaptures(1)
    },
    '-1': {
      captures: board.getCaptures(-1)
    },
  }
}

function timeout (duration) {
  return new Promise(resolve => setTimeout(resolve, duration))
}

function takeTurn (ai) {
  let gameActive = true
  const { move, pass } = ai.calculateNextMove(board, currentPlayer)
  if (pass) {
    board = board.makeMove(0, [0,0], {
      preventOverwrite: true,
      preventSuicide: true,
      preventKo: true,
    })
    // indicate game ended
    if (previousTurnDidPass) {
      gameActive = false
    }
    previousTurnDidPass = true
  } else {
    board = board.makeMove(currentPlayer, move, {
      preventOverwrite: true,
      preventSuicide: true,
      preventKo: true,
    })
    // indicate the game ended
    previousTurnDidPass = false
  }
  // update current player to next
  currentPlayer = currentPlayer === 1 ? -1 : 1
  // draw board
  renderBoard(board)
  // indicate game state
  return gameActive
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
