const { createGame } = require('./game')
const leelaSmall = require('./ais/leelazero-10x128')
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
  // start game
  const game = createGame()
  await halfDumbBot.init(game.board)
  game.takeTurn(halfDumbBot)
  game.takeTurn(halfDumbBot)
  game.takeTurn(halfDumbBot)
  game.takeTurn(halfDumbBot)
  game.takeTurn(halfDumbBot)
  game.takeTurn(halfDumbBot)
  game.takeTurn(halfDumbBot)
  console.log('ready', game)

  const viewState = {
    bunnies: [],
  }
  setupReglRenderer(viewState)


  while (game.board.isValid() && game.takeTurn(halfDumbBot)) {
    // draw board
    renderToViewState(game, viewState)
    await timeout(200)
  }
  // const scores = game.calculateScores()
  // console.log(`
  // captures:
  //   ${colors[ 1]}: ${scores[1].captures}
  //   ${colors[-1]}: ${scores[-1].captures}
  // `)
}

function renderToViewState ({ board }, viewState) {
  const bunnies = viewState.bunnies = []
  const xOffset = -160
  const yOffset = -160
  const colors = {
    '1': [0.7, 0.4, 0.1],
    '-1': [0.4, 0.2, 0.6],
  }

  for (const [yStr, row] of Object.entries(board.signMap)) {
    for (const [xStr, piece] of Object.entries(row)) {
      if (piece === 0) continue
      // chalk[colors[piece]](symbols[piece])
      const x = Number(xStr)
      const y = Number(yStr)
      bunnies.push(
        {
          color: colors[piece],
          scale: 1.0,
          position: [xOffset + x * 10, -65.0, yOffset + y * 10],
          rotation: [0.0, (piece+1) * 1.57, 0.0]
        },
      )
    }
  }
}

function setupReglRenderer (state) {
  // const regl = require('../regl')()
  // const mat4 = require('gl-mat4')

  // var cubePosition = [
  //   [-0.5, +0.5, +0.5], [+0.5, +0.5, +0.5], [+0.5, -0.5, +0.5], [-0.5, -0.5, +0.5], // positive z face.
  //   [+0.5, +0.5, +0.5], [+0.5, +0.5, -0.5], [+0.5, -0.5, -0.5], [+0.5, -0.5, +0.5], // positive x face
  //   [+0.5, +0.5, -0.5], [-0.5, +0.5, -0.5], [-0.5, -0.5, -0.5], [+0.5, -0.5, -0.5], // negative z face
  //   [-0.5, +0.5, -0.5], [-0.5, +0.5, +0.5], [-0.5, -0.5, +0.5], [-0.5, -0.5, -0.5], // negative x face.
  //   [-0.5, +0.5, -0.5], [+0.5, +0.5, -0.5], [+0.5, +0.5, +0.5], [-0.5, +0.5, +0.5], // top face
  //   [-0.5, -0.5, -0.5], [+0.5, -0.5, -0.5], [+0.5, -0.5, +0.5], [-0.5, -0.5, +0.5]  // bottom face
  // ]

  // var cubeUv = [
  //   [0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0], // positive z face.
  //   [0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0], // positive x face.
  //   [0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0], // negative z face.
  //   [0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0], // negative x face.
  //   [0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0], // top face
  //   [0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]  // bottom face
  // ]

  // const cubeElements = [
  //   [2, 1, 0], [2, 0, 3],       // positive z face.
  //   [6, 5, 4], [6, 4, 7],       // positive x face.
  //   [10, 9, 8], [10, 8, 11],    // negative z face.
  //   [14, 13, 12], [14, 12, 15], // negative x face.
  //   [18, 17, 16], [18, 16, 19], // top face.
  //   [20, 21, 22], [23, 20, 22]  // bottom face
  // ]

  const mat4 = require('gl-mat4')
  const bunny = require('bunny')
  const fit = require('canvas-fit')
  const normals = require('angle-normals')

  const canvas = document.body.appendChild(document.createElement('canvas'))
  const regl = require('regl')({canvas: canvas, extensions: ['angle_instanced_arrays']})
  const camera = require('canvas-orbit-camera')(canvas)
  window.addEventListener('resize', fit(canvas), false)

  // configure initial camera view.
  camera.rotate([0.0, 0.0], [0.0, -0.4])
  camera.zoom(70.0)

  const drawBunny = regl({
    frag: `
    precision mediump float;
    varying vec3 vNormal;
    uniform vec3 lightDir;
    uniform vec3 color;
    uniform float ambientLightAmount;
    uniform float diffuseLightAmount;
    void main () {
      vec3 ambient = ambientLightAmount * color;
      vec3 diffuse = diffuseLightAmount * color * clamp( dot(vNormal, lightDir ), 0.0, 1.0 );
      gl_FragColor = vec4(ambient + diffuse, 1.0);
    }`,
    vert: `
    precision mediump float;
    attribute vec3 position;
    attribute vec3 normal;
    varying vec3 vNormal;
    uniform mat4 projection, model, view;
    void main () {
      vNormal = normal;
      gl_Position = projection * view * model * vec4(position, 1.0);
    }`,
    attributes: {
      position: bunny.positions,
      normal: normals(bunny.cells, bunny.positions)
    },
    elements: bunny.cells,
    uniforms: {
      model: (_, props, batchId) => {
        /*
          By using props, we translate the bunny, scale it, and rotate it.
          */
        var m = mat4.identity([])

        mat4.translate(m, m, props.position)

        var s = props.scale
        mat4.scale(m, m, [s, s, s])

        var r = props.rotation
        mat4.rotateX(m, m, r[0])
        mat4.rotateY(m, m, r[1])
        mat4.rotateZ(m, m, r[2])

        return m
      },
      color: regl.prop('color'),
      // View Projection matrices.
      view: () => camera.view(),
      projection: ({viewportWidth, viewportHeight}) =>
        mat4.perspective([],
                          Math.PI / 4,
                          viewportWidth / viewportHeight,
                          0.01,
                          3000),

      // light settings. These can of course by tweaked to your likings.
      lightDir: [0.39, 0.87, 0.29],
      ambientLightAmount: 0.3,
      diffuseLightAmount: 0.7
    },
  })

  regl.frame(() => {
    regl.clear({
      color: [0, 0, 0, 1]
    })

    drawBunny(state.bunnies)

    camera.tick()
  })

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