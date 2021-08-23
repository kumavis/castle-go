
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

let loadingManager
let models = {}

let board
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

//
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
    'knight-white': {},
    'knight-black': {},
  }  
}

function buildLibertyBoard (board) {
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
  return libertyBoard
}


function boardToGameState (board) {
  const gameState = createGameState()
  const libertyBoard = buildLibertyBoard(board)
  for (const [y,row] of Object.entries(board.signMap)) {
    for (const [x,stoneValue] of Object.entries(row)) {
      let modelType, color
      if (stoneValue === 0) {
        const libertyValue = libertyBoard[y][x]
        // no liberty
        if (libertyValue === undefined) continue
        // shared liberty
        if (libertyValue === 0) continue
        modelType = 'knight'
        color = libertyValue === -1 ? 'black' : 'white'
      } else {
        modelType = 'castle'
        color = stoneValue === -1 ? 'black' : 'white'
      }
      const id = `${modelType}-${color}-${x}-${y}`
      gameState[`${modelType}-${color}`][id] = { x, y }
    }
  }
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
  await Promise.all([
    loadAsset('castle', 'models/tower-defense/Models/OBJ format/towerSquare_sampleA').promise,
    loadAsset('knight-black', 'models/castle/Models/knightBlue').promise,
    loadAsset('knight-white', 'models/castle/Models/knightRed').promise,
  ])
  models['knight-black'].object.rotation.y = 90

  // modify the asset to have 2 color versions
  models.castle.object.scale.multiplyScalar(10)
  models['castle-black'] = models['castle']
  models['castle-white'] = { ...models['castle'], object: models['castle'].object.clone() }
  // deep clone all materials
  models['castle-white'].object.traverse((node) => {
    if (node.isMesh) {
      if (Array.isArray(node.material)) {
        node.material = node.material.map(mat => mat.clone())
      } else {
        node.material = node.material.clone();
      }
    }
  });
  // change primary color
  const colorMaterial = models["castle-white"].object.children[0].material[1]
  colorMaterial.color = { r: 50/255, g: 205/255, b: 50/255 }
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
  const cameraCenterX = 250
  const cameraCenterY = 0

  camera.position.x += ( mouseX - (camera.position.x - cameraCenterX) ) * .05;
  // camera.position.y += ( - mouseY - (camera.position.y - cameraCenterY) ) * .05;

  camera.lookAt( scene.position );

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
