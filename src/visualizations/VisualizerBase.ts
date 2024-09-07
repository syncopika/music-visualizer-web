import { 
  Scene,
} from 'three';

import { AudioManager } from '../AudioManager';

export class VisualizerBase {
  name: string;
  scene: Scene;
  audioManager: AudioManager;
  
  constructor(name: string, scene: Scene, audioManager: AudioManager){
    this.scene = scene;
    this.name = name;
    this.audioManager = audioManager;
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