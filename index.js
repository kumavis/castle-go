const Board = require('@sabaki/go-board')
const chalk = require('chalk')

let board = Board.fromDimensions(9)
let currentPlayer = 1

;(async function () {
  while (board.isValid()) {
    takeTurn()
    await timeout(1000)
  }
})()

function timeout (duration) {
  return new Promise(resolve => setTimeout(resolve, duration))
}

function takeTurn () {
  const { move, pass } = calculateNextMove(board, currentPlayer)
  if (pass) {
    board = board.makeMove(0, [0,0], {
      preventOverwrite: true,
      preventSuicide: true,
      preventKo: true,
    })
  } else {
    board = board.makeMove(currentPlayer, move, {
      preventOverwrite: true,
      preventSuicide: true,
      preventKo: true,
    })
  }
  currentPlayer = currentPlayer === 1 ? -1 : 1
  drawBoard(board)
}

function calculateNextMove (board, player) {
  const xOrdering = randomOrdering(board.width)
  const yOrdering = randomOrdering(board.height)
  for (const x of xOrdering) {
    for (const y of yOrdering) {
      const vertex = [x, y]
      // exit early if not free
      if (board.get(vertex) !== 0) continue
      const analysis = board.analyzeMove(player, vertex)
      // console.log(`move analyis ${player} ${vertex}, ${JSON.stringify(analysis, null, 2)}`)
      const {
        pass,
        overwrite,
        capturing,
        suicide,
        ko,
      } = analysis
      // try again if invalid
      if (pass || overwrite || suicide || ko) {
        continue
      }
      if (capturing) {
        console.log(`capture @ ${vertex} by ${player}`)
      }
      return { move: vertex }
    }
  }
  return { pass: true }
}

function randomOrdering (length) {
  return shuffleArray(
    Array(length)
    .fill()
    .map((_,index)=>index)
  )
}

function shuffleArray (array) {
  for (var i = array.length - 1; i > 0; i--) {
      var j = randomInt(i + 1)
      var temp = array[i]
      array[i] = array[j]
      array[j] = temp
  }
  return array
}

function randomInt (max) {
  return Math.floor(Math.random() * max)
}

function drawBoard (board) {
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

      // for (const [libX, libY] of freeNeighbors) {
      //   let value = libertyBoard[libX][libY]
      //   if (value === undefined) {
      //     // uncalimed, set to self
      //     value = owner
      //   } else if (value === -owner) {
      //     // uncalimed, set to self
      //     value = 0
      //   }
      //    if (value !== owner) value += owner
      //   libertyBoard[libX][libY] = value
      //   // console.log(`lib ${target} ${[libX,libY]} ${owner} ${value}`)
      // }
    }
  }
  // console.log(libertyBoard)
  // draw board
  const xLabels = Array(board.width).fill().map((_, index) => ` ${index}`).join('')
  output += `${xLabels}\n`
  for (const [yStr, row] of Object.entries(board.signMap)) {
    output += yStr
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
  const colors = {
    '0': 'white',
    '1': 'red',
    '-1': 'blue',
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
