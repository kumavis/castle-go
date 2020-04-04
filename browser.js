const mat4 = require('gl-mat4')
const fit = require('canvas-fit')
const normals = require('angle-normals')
const canvas = document.body.appendChild(document.createElement('canvas'))
const regl = require('regl')({ canvas, extensions: ['angle_instanced_arrays']})
const camera = require('canvas-orbit-camera')(canvas)
window.addEventListener('resize', fit(canvas), false)

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

  const viewState = {}
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
  viewState.lone = []
  viewState.single = []
  viewState.straight = []
  viewState.corner = []
  viewState.tee = []
  viewState.all = []

  const squareSize = 10
  const xOffset = -1 * board.width * squareSize / 2
  const yOffset = -1 * board.height * squareSize / 2
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
      // get friendly neighbors
      // we map instead of filter to maintain shape
      const neighbors = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]
        .map(v => board.has(v) && board.get(v) === piece)
      const [shapeType, direction] = getShapeByNeighbors(neighbors)

      viewState[shapeType].push(
        {
          color: colors[piece],
          scale: 5.0,
          position: [xOffset + x * squareSize, -65.0, yOffset + y * squareSize],
          rotation: [0, 1.57 * direction, 0]
        },
      )
    }
  }
}

function getShapeByNeighbors (neighbors) {
  const count = neighbors.filter(Boolean).length

  switch (count) {
    case 0: {
      return ['lone', 0]
    }
    case 1: {
      const direction = [2,0,1,3][neighbors.indexOf(true)]
      return ['single', direction]
    }
    case 2: {
      const acrossX = (neighbors[0] && neighbors[1])
      if (acrossX) return ['straight', 0]
      const acrossY = (neighbors[2] && neighbors[3])
      if (acrossY) return ['straight', 1]
      const direction =
        (neighbors[0] && neighbors[2]) ? 2 :
        (neighbors[0] && neighbors[3]) ? 3 :
        (neighbors[1] && neighbors[2]) ? 1 : 0
      return ['corner', direction]
    }
    case 3: {
      const direction = [1,3,0,2][neighbors.indexOf(false)]
      return ['tee', direction]
    }
    case 4: {
      return ['all', 0]
    }
    default: {
      return ['lone', 0]
    }
  }


}

function setupReglRenderer (viewState) {

  // configure initial camera view.
  camera.rotate([0.0, 0.0], [0.0, -0.4])
  camera.zoom(70.0)
  // camera.lookAt(eye, center, up)

  const drawTower = {
    lone: createObjDrawer(createTowerLone()),
    single: createObjDrawer(createTowerSingle()),
    straight: createObjDrawer(createTowerStraight()),
    corner: createObjDrawer(createTowerCorner()),
    tee: createObjDrawer(createTowerTee()),
    all: createObjDrawer(createTowerAll()),
  }

  regl.frame(() => {
    regl.clear({
      color: [0, 0, 0, 1]
    })

    Object.entries(viewState).forEach(([type, items]) => {
      if (!items.length) return
      drawTower[type](items)
    })

    camera.tick()
  })

  function createObjDrawer (obj) {
    return regl({
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
        position: obj.positions,
        normal: normals(obj.cells, obj.positions)
      },
      elements: obj.cells,
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
        lightDir: [0.5, -0.5, -0.5],
        ambientLightAmount: 0.4,
        diffuseLightAmount: 0.7
      },
    })
  }

}

function timeout (duration) {
  return new Promise(resolve => setTimeout(resolve, duration))
}

function build4CornerShape (points) {
  const positions = []
  const cells = []
  const shape = { positions, cells }

  let prevFour
  let nextFour
  for (const index in points) {
    // setup symmetry sets
    prevFour = nextFour
    nextFour = getSymmetry(points[index])
    nextFour.forEach(point => positions.push(point))
    // skip first iteration
    if (index === '0') continue
    // make faces
    makeFacesFromSymmetries(prevFour, nextFour)
  }

  return shape

  function getSymmetry (point) {
    return [
      point,
      [+point[0], point[1], -point[2]],
      [-point[0], point[1], -point[2]],
      [-point[0], point[1], +point[2]],
    ]
  }

  function makeFacesFromSymmetries (prevFour, nextFour) {
    makeFace(prevFour[0], nextFour[0], nextFour[1], prevFour[1])
    makeFace(prevFour[1], nextFour[1], nextFour[2], prevFour[2])
    makeFace(prevFour[2], nextFour[2], nextFour[3], prevFour[3])
    makeFace(prevFour[3], nextFour[3], nextFour[0], prevFour[0])
  }

  function makeTriangle (vec1, vec2, vec3) {
    const index1 = positions.indexOf(vec1)
    const index2 = positions.indexOf(vec2)
    const index3 = positions.indexOf(vec3)
    if ([index1, index2, index3].includes(-1)) {
      throw new Error('cannot make traingle')
    }
    cells.push([index1, index2, index3])
  }

  function makeFace (vec1, vec2, vec3, vec4) {
    makeTriangle(vec1, vec2, vec3)
    makeTriangle(vec3, vec4, vec1)
  }
}

function createTowerLone () {
  const towerWidth = 0.4
  const nestHeightTaperStart = 0.5
  const base = build4CornerShape([
    [towerWidth,0,towerWidth],
    [towerWidth,nestHeightTaperStart,towerWidth],
  ])
  return composeShapes([
    base,
    createTowerTop(),
  ])
}

function createTowerStraight () {
  const wallWidth = 0.4
  const wallHeight = 0.5
  const wall = createCube()
  scaleByVec(wall, [2,wallHeight,wallWidth])
  return wall
}

function createTowerSingle () {
  return composeShapes([
    createWalls()[0],
    createTowerLone(),
  ])
}

function createTowerCorner () {
  return composeShapes([
    ...createWalls().slice(0,2),
    createTowerLone(),
  ])
}

function createTowerTee () {
  return composeShapes([
    ...createWalls().slice(0,3),
    createTowerLone(),
  ])
}

function createTowerAll () {
  return composeShapes([
    ...createWalls(),
    createTowerLone(),
  ])
}

function createWalls () {
  const wallWidth = 0.4
  const wallHeight = 0.5
  const scaleTrans = [
    [[1,wallHeight,wallWidth], [0.5,0,0]],
    [[wallWidth,wallHeight,1], [0,0,0.5]],
    [[1,wallHeight,wallWidth], [-0.5,0,0]],
    [[wallWidth,wallHeight,1], [0,0,-0.5]],
  ]
  return scaleTrans.map(([scale, trans]) => {
    const wall = createCube()
    scaleByVec(wall, scale)
    translateByVec(wall, trans)
    return wall
  })
}

function scaleByVec (shape, ampVec) {
  shape.positions = shape.positions.map(vec => {
    return [vec[0] * ampVec[0], vec[1] * ampVec[1], vec[2] * ampVec[2]]
  })
}

function translateByVec (shape, ampVec) {
  shape.positions = shape.positions.map(vec => {
    return [vec[0] + ampVec[0], vec[1] + ampVec[1], vec[2] + ampVec[2]]
  })
}

function createTowerTop () {
  const towerWidth = 0.4
  const nestHeightTaperStart = 0.5
  const nestWidth = 0.5
  const nestHeight = 0.6
  const nestCeiling = 0.9
  const nestRooftop = 1
  return build4CornerShape([
    [towerWidth,nestHeightTaperStart,towerWidth],
    [nestWidth,nestHeight,nestWidth],
    [nestWidth,nestCeiling,nestWidth],
    [0,nestRooftop,0],
  ])
}

function composeShapes (shapes) {
  // first shape doesnt need offsetting
  let { positions, cells } = shapes[0]
  let offset = positions.length
  // offset all other shapes
  shapes.slice(1).forEach((shape) => {
    // add positions
    positions = positions.concat(shape.positions)
    // offset and add cells
    const newCells = shape.cells.map(cell => cell.map(index => index + offset))
    cells = cells.concat(newCells)
    // update offset
    offset += shape.positions.length
  })

  return { positions, cells }
}

function createCube () {
  const cube = {
    positions: [
      [-0.5, 1, +0.5], [+0.5, 1, +0.5], [+0.5, 0, +0.5], [-0.5, 0, +0.5], // positive z face.
      [+0.5, 1, +0.5], [+0.5, 1, -0.5], [+0.5, 0, -0.5], [+0.5, 0, +0.5], // positive x face
      [+0.5, 1, -0.5], [-0.5, 1, -0.5], [-0.5, 0, -0.5], [+0.5, 0, -0.5], // negative z face
      [-0.5, 1, -0.5], [-0.5, 1, +0.5], [-0.5, 0, +0.5], [-0.5, 0, -0.5], // negative x face.
      [-0.5, 1, -0.5], [+0.5, 1, -0.5], [+0.5, 1, +0.5], [-0.5, 1, +0.5], // top face
      [-0.5, 0, -0.5], [+0.5, 0, -0.5], [+0.5, 0, +0.5], [-0.5, 0, +0.5]  // bottom face
    ],
    cells: [
      [2, 1, 0], [2, 0, 3],       // positive z face.
      [6, 5, 4], [6, 4, 7],       // positive x face.
      [10, 9, 8], [10, 8, 11],    // negative z face.
      [14, 13, 12], [14, 12, 15], // negative x face.
      [18, 17, 16], [18, 16, 19], // top face.
      [20, 21, 22], [23, 20, 22]  // bottom face
    ]
  }
  return cube
}