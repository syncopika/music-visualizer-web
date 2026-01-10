// the web worker will be responsible for scene management/rendering stuff

import { 
  WebGLRenderer,
  TextureLoader,
} from 'three';

import { SceneManager } from './SceneManager';
import { AudioManager } from './AudioManager';

import { 
  VisualizerBase, 
  ConfigurableParameterRange,
  ConfigurableParameterToggle,
} from './visualizations/VisualizerBase';
import { Waveform } from './visualizations/Waveform';
import { Starfield } from './visualizations/Starfield';
import { Pixels } from './visualizations/Pixels';
import { CircularCubes } from './visualizations/CircularCubes';
import { SphericalCubes } from './visualizations/SphericalCubes';
import { Blob as AnimatedBlob } from './visualizations/Blob';
import { Spheres } from './visualizations/Spheres';
import { Waves } from './visualizations/Waves';
import { Lights } from './visualizations/Lights';
import { Orbits } from './visualizations/Orbits';
import { ImagePlane } from './visualizations/Image';

// scene setup
const sceneManager = new SceneManager((canvasContainer as HTMLDivElement)); // initializes a scene
const renderer = sceneManager.renderer;
const scene = sceneManager.scene;
const camera = sceneManager.camera;

let visualizer: VisualizerBase | null = null;

// TODO: loading message via msg from web worker to frontend/main thread?
// stuff has loaded, hide loading message
//if(loadingMsg) loadingMsg.style.display = 'none';

visualizer = new Waveform('waveform', sceneManager, audioManager, 50);
visualizer.init();
displayVisualizerConfigurableParams(visualizer);

update();


function update(){
  renderer.render(scene, camera);
  requestAnimationFrame(update);
  if(visualizer && isPlaying){
    visualizer.update();
  }
  
  // if recording, check if now >= expectedStopTime and stop recording
  if(isRecording){
    const now = Date.now();
    if(expectedStopTime && now >= expectedStopTime){
      stopVisualization();
    }
  }
}

function switchVisualizer(evt: Event){
  // reset camera in case it was rotated or moved
  camera.position.set(0, 2, 8);
  camera.rotation.set(0, 0, 0);
  
  switch(selected){
    case 'waveform':
      visualizer = new Waveform('waveform', sceneManager, audioManager, 50);
      visualizer.init();
      break;
    case 'circular-cubes':
      visualizer = new CircularCubes('circular-cubes', sceneManager, audioManager, 50);
      visualizer.init();
      break;
    case 'spherical-cubes':
      visualizer = new SphericalCubes('spherical-cubes', sceneManager, audioManager, 60);
      visualizer.init();
      break;
    case 'starfield':
      visualizer = new Starfield('starfield', sceneManager, audioManager, 200);
      visualizer.init();
      break;
    case 'pixels':
      visualizer = new Pixels('pixels', sceneManager, audioManager);
      visualizer.init();    
      break;
    case 'blob':
      visualizer = new AnimatedBlob('blob', sceneManager, audioManager);
      visualizer.init();
      break;
    case 'spheres':
      visualizer = new Spheres('spheres', sceneManager, audioManager, 50);
      visualizer.init();
      break;
    case 'waves':
      visualizer = new Waves('waves', sceneManager, audioManager, 50);
      visualizer.init();
      break;
    case 'lights':
      visualizer = new Lights('lights', sceneManager, audioManager, 30);
      visualizer.init();
      break;
    case 'orbits':
      visualizer = new Orbits('orbits', sceneManager, audioManager, 40);
      visualizer.init();
      break;
    case 'image':
      visualizer = new ImagePlane('imagePlane', sceneManager, audioManager);
      visualizer.init();
      break;
    default:
      break;
  }
  
  // TODO: send msg to main thread/frontend about this
  //if(visualizer) displayVisualizerConfigurableParams(visualizer);
}

// message handling
self.onmessage = (evt) => {
  // msg: switch visualizer 
  
  // msg: update fft size
  
  // msg: update texture
  
  // msg: change video quality
  
  // msg: update scene lighting
  
  // msg: update visualization color
  
  // msg: update scene background color
  
  // msg: start visualizer
  
  // msg: stop visualizer
};

// empty export so TypeScript treats this as a module
export {};