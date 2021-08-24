
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
    const castle = models[modelType].object.clone()
    castle.gameId = id
    scene.add(castle)
    castle.position.x = modelState.x * 10
    castle.position.z = modelState.y * 10
  },
  replace (id, modelType, modelState, patch) {
    // console.log('replace', id, patch)
    const castle = scene.getObjectByProperty('gameId', id)
    castle.position.x = modelState.x * 10
    castle.position.z = modelState.y * 10
  },
  remove (id, modelType, modelState, patch) {
    // console.log('remove', id, patch)
    const castle = scene.getObjectByProperty('gameId', id)
    scene.remove(castle)
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
  await timeout(500)
}


function createGameState () {
  return {
    'castle-white': {},
    'castle-black': {},
    'tent-white': {},
    'tent-black': {},
    'knight-white': {},
    'knight-black': {},
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
  visitBoard(board, (vertex, stoneValue) => {
    let modelType, color
    const [x,y] = vertex
    if (stoneValue === 0) {
      const libertyValue = libertyBoard[y][x]
      // no liberty
      if (libertyValue === undefined) return
      // shared liberty
      if (libertyValue === 0) return
      modelType = 'knight'
      color = libertyValue === -1 ? 'black' : 'white'
    } else {
      const strength = getFriendlyNeighborCount(board, vertex)
      modelType = strength > 0 ? 'castle' : 'tent'
      color = stoneValue === -1 ? 'black' : 'white'
    }
    const id = `${modelType}-${color}-${x}-${y}`
    gameState[`${modelType}-${color}`][id] = { x, y }
  })

  return gameState
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
    loadAsset('castle-black', 'models/tower-defense/Models/OBJ format/towerSquare_sampleA').promise,
    loadAsset('knight-black', 'models/castle/Models/knightBlue').promise,
    loadAsset('knight-white', 'models/castle/Models/knightRed').promise,
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
  models['knight-white'].object.rotation.y = 1/4 * fullTurn
  models['knight-black'].object.rotation.y = 3/8 * fullTurn
  models['castle-black'].object.scale.multiplyScalar(10)
  // modify the asset to have 2 color versions
  models['tent-black'] = { ...models['tent-white'], object: models['tent-white'].object.clone() }
  cloneTextures(models['tent-black'].object)
  models['tent-black'].object.children[0].material[0].color = blueColor
  models['castle-white'] = { ...models['castle-black'], object: models['castle-black'].object.clone() }
  // deep clone all materials
  cloneTextures(models['castle-white'].object)
  // change primary colors
  models["castle-black"].object.children[0].material[1].color = blueColor
  models["castle-white"].object.children[0].material[1].color = redColor
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
