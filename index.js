
import gameHistory from './game-snapshot.js'
import GoBoard from './go-board.js'
import * as THREE from 'https://threejs.org/build/three.module.js';

import { DDSLoader } from 'https://threejs.org/examples/jsm/loaders/DDSLoader.js';
import { MTLLoader } from 'https://threejs.org/examples/jsm/loaders/MTLLoader.js';
import { OBJLoader } from 'https://threejs.org/examples/jsm/loaders/OBJLoader.js';
const timeout = function (duration) { return new Promise(resolve => setTimeout(resolve, duration))}

let camera, scene, renderer;

let mouseX = 0, mouseY = 0;

let windowHalfX = window.innerWidth / 2;
let windowHalfY = window.innerHeight / 2;

const fullTurn = Math.PI * 2

let loadingManager
let models = {}
globalThis.models = models

let board = new GoBoard(gameHistory[0])
let prevGameState = createGameState()
let gameState = createGameState()

const sceneUpdaters = {
  add (id, modelType, modelState, patch) {
    // console.log('add', id, patch)
    const obj = models[modelType].object.clone()
    obj.gameId = id
    scene.add(obj)
    obj.position.x = modelState.x * 10
    obj.position.z = modelState.y * 10
    obj.rotation.y = modelState.direction/4 * fullTurn
  },
  replace (id, modelType, modelState, patch) {
    // console.log('replace', id, patch)
    const obj = scene.getObjectByProperty('gameId', id)
    obj.position.x = modelState.x * 10
    obj.position.z = modelState.y * 10
  },
  remove (id, modelType, modelState, patch) {
    // console.log('remove', id, patch)
    const obj = scene.getObjectByProperty('gameId', id)
    scene.remove(obj)
  },
}

init();
await loadAllAssets();
animate();
drawGround(board)

globalThis.scene = scene

// play back game history
for (const snapshot of gameHistory) {
  board = new GoBoard(snapshot)
  gameState = boardToGameState(board)
  updateScene()
  await timeout(100)
}


function createGameState () {
  return {
    'castle-tower-white': {},
    'castle-tower-black': {},
    'castle-wall-white': {},
    'castle-wall-black': {},
    'castle-tee-white': {},
    'castle-tee-black': {},
    'castle-corner-white': {},
    'castle-corner-black': {},
    'tent-white': {},
    'tent-black': {},
    'knight-white': {},
    'knight-black': {},
    'mangonel-white': {},
    'mangonel-black': {},
  }  
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
  const hasBlack = board.signMap.some(row => row.some(stone => stone === 1))
  const hasWhite = board.signMap.some(row => row.some(stone => stone === -1))
  // territory requires each player to have player at least once (actually twice?)
  if (!hasBlack || !hasWhite) return territoryBoard
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

function getNeighborValues (board, vertex) {
  return board.getNeighbors(vertex).map(v => board.get(v))
}

function getFriendlyNeighborCount (board, vertex) {
  const owner = board.get(vertex)
  const friendlyNeighbors = getNeighborValues(board, vertex).filter(o => o === owner)
  return friendlyNeighbors.length
}

function boardToGameState (board) {
  const gameState = createGameState()
  const libertyBoard = createLibertyBoard(board)
  const territoryBoard = createTerritoryBoard(board)
  visitBoard(board, (vertex, stoneValue) => {
    let modelType, color, direction = 0
    const [x,y] = vertex
    if (stoneValue === 0) {
      // no stone, check liberty
      const territoryValue = territoryBoard[y][x]
      if (territoryValue !== 0) {
        modelType = 'mangonel'
        color = territoryValue === -1 ? 'black' : 'white'
      } else {
        const libertyValue = libertyBoard[y][x]
        // no liberty
        if (libertyValue === undefined) return
        // shared liberty
        if (libertyValue === 0) return
        modelType = 'knight'
        color = libertyValue === -1 ? 'black' : 'white'
      }
    } else {
      color = stoneValue === -1 ? 'black' : 'white'
      const [shape, shapeDir] = getShapeByNeighbors(board, vertex)
      direction = shapeDir
      modelType = modelTypeForShape(shape)
    }
    const id = `${modelType}-${color}-${x}-${y}`
    gameState[`${modelType}-${color}`][id] = { x, y, direction }
  })

  return gameState
}

function modelTypeForShape (shape) {
  switch (shape) {
    case 'lone': {
      // const strength = getFriendlyNeighborCount(board, vertex)
      return 'tent'
    }
    case 'single': {
      return 'castle-tower'
    }
    case 'straight': {
      return 'castle-wall'
    }
    case 'corner': {
      return 'castle-corner'
    }
    case 'tee': {
      return 'castle-tee'
    }
    default: {
      return 'castle-tower'
    }
  }
}

// "fixed" means this will return spaces even if they are off the board
function getMatchingNeighborsFixed (board, [x, y]) {
  const stoneValue = board.get([x, y])
  // we map instead of filter to maintain shape
  const neighbors = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]
    .map(v => board.has(v) && board.get(v) === stoneValue)
  return neighbors
}

function getShapeByNeighbors (board, vertex) {
  const neighbors = getMatchingNeighborsFixed(board, vertex)
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

function init() {

  const container = document.createElement( 'div' );
  document.body.appendChild( container );

  camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 2000 );
  camera.position.z = 250;
  camera.position.y = 250;

  // scene

  scene = new THREE.Scene();

  const ambientLight = new THREE.AmbientLight( 0xcccccc, 0.4 );
  scene.add( ambientLight );

  const pointLight = new THREE.PointLight( 0xffffff, 0.8 );
  camera.add( pointLight );
  scene.add( camera );

  loadingManager = new THREE.LoadingManager();
  loadingManager.addHandler( /\.dds$/i, new DDSLoader() );

  renderer = new THREE.WebGLRenderer();
  renderer.setPixelRatio( window.devicePixelRatio );
  renderer.setSize( window.innerWidth, window.innerHeight );
  container.appendChild( renderer.domElement );

  document.addEventListener( 'mousemove', onDocumentMouseMove );
  window.addEventListener( 'resize', onWindowResize );
}

function updateScene () {
  // get diff
  const patches = jsonpatch.compare(prevGameState,gameState)
  // this is supa jank but it works for now
  for (const patch of patches) {
    const [,modelType,id] = patch.path.split('/')
    const modelValue = gameState[modelType][id]
    sceneUpdaters[patch.op](id, modelType, modelValue, patch)
  }
  // done
  prevGameState = jsonpatch.deepClone(gameState)
}

async function loadAllAssets () {
  const redColor = { r: 210/255, g: 70/255, b: 30/255 }
  const blueColor = { r: 80/255, g: 133/255, b: 188/255 }
  await Promise.all([
    loadAsset('tent-white', 'models/nature/Models/OBJ format/tent_detailedOpen').promise,
    loadAsset('castle-tower-black', 'models/castle/Models/towerSquareRoof').promise,
    loadAsset('castle-wall-black', 'models/castle/Models/wall').promise,
    loadAsset('castle-tee-black', 'models/castle/Models/wallHalf').promise,
    loadAsset('castle-corner-black', 'models/castle/Models/wallCorner').promise,
    loadAsset('flag-black', 'models/castle/Models/flagBlue').promise,
    loadAsset('knight-black', 'models/castle/Models/knightBlue').promise,
    loadAsset('knight-white', 'models/castle/Models/knightRed').promise,
    loadAsset('mangonel-black', 'models/castle/Models/siegeCatapult').promise,
    loadAsset('ground-grass', 'models/nature/Models/OBJ format/ground_grass').promise,
    loadAsset('cliff-top-rock', 'models/nature/Models/OBJ format/cliff_top_rock').promise,
    loadAsset('plant-bush-small', 'models/nature/Models/OBJ format/plant_bushSmall').promise,
    loadAsset('plant-lily-large', 'models/nature/Models/OBJ format/lily_large').promise,
  ])
  // tweak
  models['tent-white'].object.scale.multiplyScalar(10)
  models['ground-grass'].object.scale.multiplyScalar(10)
  models['plant-bush-small'].object.scale.multiplyScalar(10)
  models['plant-lily-large'].object.scale.multiplyScalar(10)
  models['cliff-top-rock'].object.scale.multiplyScalar(10)
  // models['knight-white'].object.children[1].rotation.y = 1/4 * fullTurn
  models['knight-black'].object.children[1].rotation.y = 3/8 * fullTurn
  models['castle-tower-black'].object.children[0].position.x += 5
  models['castle-tower-black'].object.children[0].position.z -= 5
  models['castle-wall-black'].object.children[0].rotation.y = 1/4 * fullTurn
  models['castle-wall-black'].object.children[0].position.x += 5
  models['castle-wall-black'].object.children[0].position.z += 5
  models['castle-tee-black'].object.children[0].rotation.y = 3/4 * fullTurn
  models['castle-tee-black'].object.children[0].position.x -= 5
  models['castle-tee-black'].object.children[0].position.z -= 5
  models['castle-corner-black'].object.children[0].rotation.y = 3/4 * fullTurn
  models['castle-corner-black'].object.children[0].position.x -= 5
  models['castle-corner-black'].object.children[0].position.z -= 5
  models['flag-black'].object.scale.multiplyScalar(1.5)
  models['flag-black'].object.position.y += 10
  models['mangonel-black'].object.scale.multiplyScalar(0.6)
  // modify the asset to have 2 color versions
  models['mangonel-white'] = cloneModel(models['mangonel-black'])
  models['flag-white'] = cloneModel(models['flag-black'])
  models['flag-white'].object.children[1].material.color = redColor
  models['flag-white'].object.children[0].material[1].color = redColor
  models['castle-tower-white'] = cloneModel(models['castle-tower-black'])
  models['castle-tower-white'].object.children[0].material[2].color = redColor
  models['castle-wall-white'] = cloneModel(models['castle-wall-black'])
  models['castle-tee-white'] = cloneModel(models['castle-tee-black'])
  models['castle-corner-white'] = cloneModel(models['castle-corner-black'])
  models['tent-black'] = cloneModel(models['tent-white'])
  models['tent-black'].object.children[0].material[0].color = blueColor
  models['mangonel-white'].object.children[2].material[0].color = redColor
  models['mangonel-white'].object.children[3].material[0].color = redColor
  models['mangonel-white'].object.children[0].material[2].color = redColor

  // compose
  models['castle-corner-white'].object.add(models['flag-white'].object.clone())
  models['castle-corner-black'].object.add(models['flag-black'].object.clone())
}

function cloneModel (model) {
  const cloned = { ...model, object: model.object.clone() }
  cloneTextures(cloned.object)
  return cloned
}

function cloneTextures (object) {
  object.traverse((node) => {
    if (!node.isMesh) return
    if (Array.isArray(node.material)) {
      node.material = node.material.map(mat => mat.clone())
    } else {
      node.material = node.material.clone();
    }
  });
}

function drawGround (board) {
  const width = board.signMap[0].length
  const height = board.signMap.length
  // draw ground
  for (const [y, row] of Object.entries(board.signMap)) {
    for (const [x, value] of Object.entries(row)) {
      const ground = models["ground-grass"].object.clone()
      ground.position.x = Number(x) * 10
      ground.position.z = Number(y) * 10
      scene.add(ground)
      // draw plants
      if (Math.random() > 0.2) continue
      const plants = ['plant-bush-small', 'plant-lily-large']
      const type = plants[Math.floor(Math.random()*plants.length)]
      const plant = models[type].object.clone()
      plant.position.x = Number(x) * 10
      plant.position.z = Number(y) * 10
      scene.add(plant)
    }
  }
  // draw cliff
  for (const x in Array(width).fill()) {
    const front = models["cliff-top-rock"].object.clone()
    front.position.x = Number(x) * 10
    front.position.z = height * 10
    front.position.y = -10
    scene.add(front)
    const back = models["cliff-top-rock"].object.clone()
    back.position.x = Number(x) * 10
    back.position.z = -1 * 10
    back.position.y = -10
    back.rotation.y = 1/2 * fullTurn
    scene.add(back)
  }
  for (const y in Array(height).fill()) {
    const front = models["cliff-top-rock"].object.clone()
    front.position.x = width * 10
    front.position.z = Number(y) * 10
    front.position.y = -10
    front.rotation.y = 1/4 * fullTurn
    scene.add(front)
    const back = models["cliff-top-rock"].object.clone()
    back.position.x = -1 * 10
    back.position.z = Number(y) * 10
    back.position.y = -10
    back.rotation.y = 3/4 * fullTurn
    scene.add(back)
  }
}

function loadAsset (name, path) {
  // todo progress hook
  function onProgress () {}
  const { resolve, reject, promise } = deferred()

  new MTLLoader( loadingManager )
  .load( `${path}.mtl`, function ( materials ) {

    materials.preload();

    new OBJLoader( loadingManager )
      .setMaterials( materials )
      .load( `${path}.obj`, function ( object ) {
        models[name] = { object, materials }
        resolve({ object, materials })
      }, onProgress, reject );

  } );
  return { promise }
}

function onWindowResize() {

  windowHalfX = window.innerWidth / 2;
  windowHalfY = window.innerHeight / 2;

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize( window.innerWidth, window.innerHeight );

}

function onDocumentMouseMove( event ) {

  mouseX = ( event.clientX - windowHalfX ) / 2;
  // mouseY = ( event.clientY - windowHalfY ) / 2;

}

//

function animate() {

  requestAnimationFrame( animate );
  render();

}

function render() {
  camera.position.x += ( mouseX - (camera.position.x) ) * .05;
  // camera.position.y += ( - mouseY - (camera.position.y) ) * .05;

  const target = scene.position.clone()
  target.x += board.width * 10 / 2
  target.z += board.height * 10 / 2
  camera.lookAt( target );

  renderer.render( scene, camera );

}

// const { resolve, reject, promise } = deferred()
function deferred () {
  let resolve, reject, promise
  promise = new Promise((_resolve, _reject) => {
    resolve = _resolve
    reject = _reject
  })
  return { resolve, reject, promise }
}

function vertexEquals([x1, y1], [x2, y2]) {
  return x1 === x2 && y1 === y2
}