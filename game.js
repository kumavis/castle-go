// patch for browserify
const util = require('util')
util.promisify = util.promisify || require('util-promisify')

const Board = require('@sabaki/go-board')


module.exports = { createGame }

function createGame () {
  const game = {
    // state
    board: Board.fromDimensions(19),
    currentPlayer: 1,
    previousTurnDidPass: false,
    // functions
    calculateScores: (...args) => calculateScores(game, ...args),
    takeTurn: (...args) => takeTurn(game, ...args),
  }
  return game
}

function calculateScores ({ board }) {
  return {
    '1': {
      captures: board.getCaptures(1)
    },
    '-1': {
      captures: board.getCaptures(-1)
    },
  }
}

function takeTurn (game, ai) {
  let gameActive = true
  const { move, pass } = ai.calculateNextMove(game.board, game.currentPlayer)
  if (pass) {
    game.board = game.board.makeMove(0, [0,0], {
      preventOverwrite: true,
      preventSuicide: true,
      preventKo: true,
    })
    // indicate game ended
    if (game.previousTurnDidPass) {
      gameActive = false
    }
    game.previousTurnDidPass = true
  } else {
    game.board = game.board.makeMove(game.currentPlayer, move, {
      preventOverwrite: true,
      preventSuicide: true,
      preventKo: true,
    })
    // indicate the game ended
    game.previousTurnDidPass = false
  }
  // update current player to next
  game.currentPlayer = game.currentPlayer === 1 ? -1 : 1
  // indicate game state
  return gameActive
}
