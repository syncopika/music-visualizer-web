import { VisualizerBase } from './VisualizerBase';
import { SceneManager } from '../SceneManager';
import { AudioManager } from '../AudioManager';

// TODO: allow user to import image to show on plane
// check out https://github.com/syncopika/room-designer/blob/main/src/index.js
// https://github.com/syncopika/room-designer/blob/main/src/index.js#L742
// https://github.com/syncopika/room-designer/blob/main/src/index.js#L407

import {
  Mesh,
  Vector3,
  Group,
  PlaneGeometry,
  MeshBasicMaterial,
  TextureLoader,
  DoubleSide,
} from 'three';

export class ImagePlane extends VisualizerBase {
  visualization: Group;
  
  constructor(name: string, sceneManager: SceneManager, audioManager: AudioManager){
    super(name, sceneManager, audioManager);
    this.visualization = new Group();
  }
  
  init(){
    // clear the scene
    this.scene.children.forEach(c => {
      if(
        !c.type.toLowerCase().includes('camera') && 
        !c.type.toLowerCase().includes('light'))
      {  
        this.scene.remove(c);
      }
    });
    
        // create plane mesh to hold image
    const planeGeometry = new PlaneGeometry(30, 30, 1, 1);
    const planeMaterial = new MeshBasicMaterial({color: 0x00ff00, side: DoubleSide});
    const plane = new Mesh(planeGeometry, planeMaterial);
    this.visualization.add(plane);
    
    this.scene.add(this.visualization);
    this.visualization.position.z = -25;
    this.visualization.position.y -= 0.5;
  }
  
  update(){
    this.doPostProcessing();
    //this.visualization.rotateY(Math.PI / 300);
  }
}
