import { 
  Scene,
  Camera,
  Clock,
  WebGLRenderer,
} from 'three';

import { SceneManager } from '../SceneManager';
import { AudioManager } from '../AudioManager';

export class VisualizerBase {
  name: string;
  sceneManager: SceneManager;
  audioManager: AudioManager;
  clock: Clock;
  scene: Scene;
  camera: Camera;
  renderer: WebGLRenderer;
  
  constructor(name: string, sceneManager: SceneManager, audioManager: AudioManager){
    this.name = name;
    this.sceneManager = sceneManager;
    this.audioManager = audioManager;
    this.scene = sceneManager.scene;
    this.clock = sceneManager.clock;
    this.camera = sceneManager.camera;
    this.renderer = sceneManager.renderer;
  }

  init(){
    // initialize the scene
  }
  
  update(){
    // run the visualizer.
  }

  info(){
    // TODO: get some info about the scene
    console.log(`some info about the ${this.name} visualizer.`);
  }
}