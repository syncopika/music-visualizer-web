import { VisualizerBase } from './VisualizerBase';

import { AudioManager } from '../AudioManager';

import {
  Scene, 
  Mesh,
  BoxGeometry,
  MeshPhongMaterial,
  Vector3,
  Group,
} from 'three';

export class Waveform extends VisualizerBase {
  numObjects: number;
  visualization: Group;
  
  constructor(name: string, scene: Scene, audioManager: AudioManager, size: number){
    super(name, scene, audioManager);
    this.numObjects = size;
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
    
    const bufferLen = this.audioManager.analyser.frequencyBinCount;

    const numObjects = this.numObjects;
    const increment = Math.floor(bufferLen / numObjects);
    const xIncrement = 0.93;
    let xPos = -25;

    function createVisualizationCube(){
      const boxGeometry = new BoxGeometry(0.4, 0.4, 0.4);
      const boxMaterial = new MeshPhongMaterial({color: '#aaff00'});
      const box = new Mesh(boxGeometry, boxMaterial);
      box.receiveShadow = true;
      box.castShadow = true;
      return box;
    }
    
    for(let i = 0; i < bufferLen; i += increment){
      const newCube = createVisualizationCube();

      newCube.position.x = xPos + xIncrement;

      this.visualization.add(newCube);

      xPos += xIncrement;
    }
    
    this.scene.add(this.visualization);
    this.visualization.position.z = -12;
  }
  
  update(){
    const bufferLength = this.audioManager.analyser.frequencyBinCount;
    const buffer = this.audioManager.buffer;
    const numObjects = this.visualization.children.length;
    const increment = Math.floor(bufferLength / numObjects);
    
    this.audioManager.analyser.getByteTimeDomainData(buffer);
    
    for(let i = 0; i < numObjects; i++){
      const value = buffer[i * increment] / 255; //128.0; // why 128?
      const y = value * 6; // multiply by maximum height
      const obj = this.visualization.children[i];
      obj.position.lerp(new Vector3(obj.position.x, y, obj.position.z), 0.3); // lerp for smoother animation
    }
    
    //this.visualization.rotateY(Math.PI / 350);
  }
}
