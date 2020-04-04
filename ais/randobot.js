module.exports = {
  init: async () => {},
  calculateNextMove,
}

function calculateNextMove (board, player) {
  const xOrdering = randomOrdering(board.width)
  const yOrdering = randomOrdering(board.height)
  // try every position in the random ordering til you find a valid move
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
      return { move: vertex }
    }
  }
  // no valid moves found
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