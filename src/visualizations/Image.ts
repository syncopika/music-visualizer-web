import {
  VisualizerBase,
  ConfigurableParameterRange,
  ConfigurableParameterToggle,
} from './VisualizerBase';
import { SceneManager } from '../SceneManager';
import { AudioManager } from '../AudioManager';

// allow user to import image to show on plane
// https://github.com/syncopika/room-designer/blob/main/src/index.js#L742
// https://github.com/syncopika/room-designer/blob/main/src/index.js#L407

import {
  Mesh,
  Group,
  PlaneGeometry,
  MeshBasicMaterial,
  DoubleSide,
} from 'three';

export class ImagePlane extends VisualizerBase {
  visualization: Group;
  
  constructor(name: string, sceneManager: SceneManager, audioManager: AudioManager){
    super(name, sceneManager, audioManager);
    this.visualization = new Group();
    
    const params: Record<string, ConfigurableParameterRange> = {
      'xPos': {value: 0, min: -15, max: 15, step: 0.5},
      'yPos': {value: 1.5, min: -15, max: 15, step: 0.5},
      'zPos': {value: -25, min: -50, max: 10, step: 0.5},
      'xScale': {value: 1, min: 0.2, max: 3, step: 0.1},
      'yScale': {value: 1, min: 0.2, max: 3, step: 0.1},
    };
    
    Object.keys(params).forEach(p => this.configurableParams[p] = params[p]);
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
    const planeMaterial = new MeshBasicMaterial({color: 0xffffff, side: DoubleSide});
    const plane = new Mesh(planeGeometry, planeMaterial);
    this.visualization.add(plane);
    
    this.scene.add(this.visualization);
    this.visualization.position.z = -25;
    this.visualization.position.y += 1.5;
  }
  
  update(){
    this.doPostProcessing();
    //this.visualization.rotateY(Math.PI / 300);
    
    const params = this.configurableParams;
    this.visualization.position.x = (params.xPos as ConfigurableParameterRange).value;
    this.visualization.position.y = (params.yPos as ConfigurableParameterRange).value;
    this.visualization.position.z = (params.zPos as ConfigurableParameterRange).value;
    
    const xScale = (params.xScale as ConfigurableParameterRange).value;
    const yScale = (params.yScale as ConfigurableParameterRange).value;
    this.visualization.scale.set(xScale, yScale, 1);
  }
}
