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
  const game = createGame()
  await halfDumbBot.init(game.board)
  while (game.board.isValid() && game.takeTurn(halfDumbBot)) {
    // draw board
    renderBoard(game.board)
    await timeout(0)
  }
  const scores = game.calculateScores()
  console.log(`
  captures:
    ${colors[ 1]}: ${scores[1].captures}
    ${colors[-1]}: ${scores[-1].captures}
  `)
}

function createLibertyBoard (board) {
  // build liberties
  const libertyBoard = Array(board.height).fill().map(() => Array(board.width).fill(0))
  visitBoard(board, (vertex, piece) => {
    const [x, y] = vertex
    const ownedNeighbors = board.getNeighbors(vertex)
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
  })
  return libertyBoard
}

function visitBoard (board, visitorFn) {
  for (const [yStr, row] of Object.entries(board.signMap)) {
    for (const [xStr, owner] of Object.entries(row)) {
      const vertex = [Number(xStr), Number(yStr)]
      visitorFn(vertex, board.get(vertex))
    }
  }
}

function getEmptyTiles (board) {
  const emptyTiles = []
  visitBoard(board, (vertex, piece) => {
    if (piece === 0) emptyTiles.push(vertex)
  })
  return emptyTiles
}

function getEmptyChains (board) {
  const emptyChains = []
  for (const vertex of getEmptyTiles(board)) {
    // have we already captured this group?
    if (emptyChains.some(chain => hasVertex(chain, vertex))) continue
    const chain = board.getChain(vertex)
    emptyChains.push(chain)
  }
  return emptyChains
}

function hasVertex (chain, vertex) {
  return chain.some(w => vertexEquals(w, vertex))
}

function getChainNeighbors (board, chain) {
  const neighbors = []
  for (const vertex of chain) {
    for (const neighbor of board.getNeighbors(vertex)) {
      if (hasVertex(chain, neighbor)) continue
      if (hasVertex(neighbors, neighbor)) continue
      neighbors.push(neighbor)
    }
  }
  return neighbors
}

function createTerritoryBoard (board) {
  const territoryBoard = Array(board.height).fill().map(() => Array(board.width).fill(0))
  const emptyChains = getEmptyChains(board)
  for (const chain of emptyChains) {
    const neighbors = getChainNeighbors(board, chain)
    const neighborTypes = new Set(neighbors.map(v => board.get(v)))
    // if more than one kind of territory, its not a neighbor
    if (neighborTypes.size !== 1) continue
    chain.forEach(([x,y]) => {
      const [owner] = neighborTypes
      territoryBoard[y][x] = owner
    })
  }
  return territoryBoard
}

function renderBoard (board) {
  let output = ''
  const libertyBoard = createLibertyBoard(board)
  const territoryBoard = createTerritoryBoard(board)
  // console.log(libertyBoard)
  // draw board
  // const xLabels = Array(board.width).fill().map((_, index) => `${index}`.padStart(2)).join('')
  const xLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.slice(0,board.width).split('').join(' ')
  output += `  ${xLabels}\n`
  for (const [yStr, row] of Object.entries(board.signMap)) {
    output += yStr.padStart(2)
    for (const [xStr, pieceValue] of Object.entries(row)) {
      const territoryValue = territoryBoard[yStr][xStr]
      const libertyValue = libertyBoard[yStr][xStr]
      output += renderPiece(pieceValue, territoryValue, libertyValue)
    }
    output += '\n'
  }
  console.log(" ░▒▓█".split('').map(v => chalk.red(v)).join(''))
  console.log(output)
}

function renderPiece (pieceValue, territoryValue, libertyValue) {
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
  const types = {
    '0': '  ',
    '1': '░░',
    '2': '▓▓',
    '3': '██',
  }
  // const types = {
  //   '0': '  ',
  //   '1': 'll',
  //   '2': 'tt',
  //   '3': '██',
  // }
  const value = (pieceValue * 3) || (territoryValue * 2) || libertyValue || 0
  // const value = territoryValue * 2
  const type = Math.abs(value)
  const symbol = types[type]
  // const symbol = territoryValue < 0 ? 2 : territoryValue
  let color = value > 0 ? 'red' : 'blue'
  if (value === 0 && libertyValue === 0) color = 'magenta'

  // if (piece === 0 && liberty !== undefined) {
  //   return chalk[partialColors[liberty]](partial)
  // } else {
  //   return chalk[colors[piece]](symbols[piece])
  // }
  return chalk[color](symbol)
}

function timeout (duration) {
  return new Promise(resolve => setTimeout(resolve, duration))
}

function vertexEquals([x1, y1], [x2, y2]) {
  return x1 === x2 && y1 === y2
}