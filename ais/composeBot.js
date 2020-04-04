

module.exports = { composeBot }

function composeBot (botsAndWeights) {
  const bots = []
  const weights = []
  for (const [weight, bot] of botsAndWeights) {
    bots.push(bot)
    weights.push(weight)
  }
  return {
    init: async (board) => Promise.all(bots.map(bot => bot.init(board))),
    calculateNextMove: (...args) => {
      const index = randomIndexFromWeights(weights)
      const bot = bots[index]
      return bot.calculateNextMove(...args)
    },
  }

}

function randomIndexFromWeights (weights) {
  const sum = weights.reduce((acc,v) => acc + v)
  let value = Math.random() * sum
  for (const [index, weight] of Object.entries(weights)) {
    value -= weight
    if (value < 0) return index
  }
}