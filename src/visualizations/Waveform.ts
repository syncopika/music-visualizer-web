import { VisualizerBase } from './VisualizerBase';
import { SceneManager } from '../SceneManager';
import { AudioManager } from '../AudioManager';

import {
  Mesh,
  BoxGeometry,
  MeshPhongMaterial,
  Vector3,
  Group,
} from 'three';

export class Waveform extends VisualizerBase {
  numObjects: number;
  visualization: Group;
  lastTime: number;
  moveTo: number[];
  
  constructor(name: string, sceneManager: SceneManager, audioManager: AudioManager, size: number){
    super(name, sceneManager, audioManager);
    this.numObjects = size;
    this.visualization = new Group();
    this.lastTime = this.clock.getElapsedTime();
    this.moveTo = [];
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
    this.visualization.position.z = -15;
    this.visualization.position.y -= 0.5;
  }
  
  update(){
    const bufferLength = this.audioManager.analyser.frequencyBinCount;
    const buffer = this.audioManager.buffer;
    const numObjects = this.visualization.children.length;
    const increment = Math.floor(bufferLength / numObjects);
    
    this.audioManager.analyser.getByteTimeDomainData(buffer);
    
    const moveToIsEmpty = this.moveTo.length === 0;
    const timeInterval = 0.04; // messing with this value can produce some interesting results!
    const elapsedTime = this.clock.getElapsedTime();
    const factor = 8;
    
    if(elapsedTime - this.lastTime >= timeInterval){
      this.lastTime = elapsedTime;
      
      for(let i = 0; i < numObjects; i++){
        const value = buffer[i * increment] / 255;
        const y = value * factor;
        //y = y < this.visualization.children[i].position.y ? 0 : y;

        if(moveToIsEmpty){
          this.moveTo.push(y);
        }else{
          this.moveTo[i] = y;
        }
      }
    }else{
      const lerpAmount = (elapsedTime - this.lastTime) / timeInterval;
      
      for(let i = 0; i < numObjects; i++){
        const value = buffer[i * increment] / 255;
        const y = value * factor;
        //y = y < this.visualization.children[i].position.y ? 0 : y;
        const obj = this.visualization.children[i];
        
        let valToMoveTo;
        
        if(moveToIsEmpty){
          this.moveTo.push(y);
          valToMoveTo = y;
        }else{
          valToMoveTo = this.moveTo[i];
        }
        
        const newPos = new Vector3(obj.position.x, valToMoveTo, obj.position.z);
      
        obj.position.lerpVectors(
          obj.position, 
          newPos, 
          lerpAmount,
        );
      }
    }
    
    /*
    for(let i = 0; i < numObjects; i++){
      const value = buffer[i * increment] / 255; //128.0; // why 128?
      const y = value * 5; // multiply by maximum height
      const obj = this.visualization.children[i];
      obj.position.lerp(new Vector3(obj.position.x, y, obj.position.z), 0.5);
    }*/
  }
}
