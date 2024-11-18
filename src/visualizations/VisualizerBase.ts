import { 
  Scene,
  Camera,
  Clock,
  WebGLRenderer,
} from 'three';

import { SceneManager } from '../SceneManager';
import { AudioManager } from '../AudioManager';

export interface ConfigurableParameterRange {
  value: number;
  min: number;
  max: number;
  step: number;
  doNotShow?: boolean; // in case we still need to figure stuff out but would like to make it user-configurable in the future :)
}

export interface ConfigurableParameterToggle {
  isOn: boolean;
  doNotShow?: boolean;
}

export class VisualizerBase {
  name: string;
  sceneManager: SceneManager;
  audioManager: AudioManager;
  clock: Clock;
  scene: Scene;
  camera: Camera;
  renderer: WebGLRenderer;
  configurableParams: Record<string, ConfigurableParameterRange | ConfigurableParameterToggle>;
  
  constructor(name: string, sceneManager: SceneManager, audioManager: AudioManager){
    this.name = name;
    this.sceneManager = sceneManager;
    this.audioManager = audioManager;
    this.scene = sceneManager.scene;
    this.clock = sceneManager.clock;
    this.camera = sceneManager.camera;
    this.renderer = sceneManager.renderer;
    this.configurableParams = {};
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