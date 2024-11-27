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

export class CircularCubes extends VisualizerBase {
  numObjects: number;
  visualization: Group;
  lastTime: number;
  scaleTo: number[];
  
  constructor(name: string, sceneManager: SceneManager, audioManager: AudioManager, size: number){
    super(name, sceneManager, audioManager);
    this.numObjects = size;
    this.visualization = new Group();
    this.lastTime = this.clock.getElapsedTime();
    this.scaleTo = [];
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
    
    // if a small analyser.fftSize is chosen, frequencyBinCount will be small as well and
    // so Math.floor(bufferLen / numObjects) may end up being 0
    const increment = Math.max(1, Math.floor(bufferLen / numObjects));
    
    // arrange cubes in a circle
    const radius = 10;
    const angle = 360 / numObjects;
    let currAngle = 0;

    function createVisualizationCube(){
      const boxGeometry = new BoxGeometry(0.4, 0.4, 0.4);
      const boxMaterial = new MeshPhongMaterial({color: '#ffffdd'}); // TODO: color gradient?
      const box = new Mesh(boxGeometry, boxMaterial);
      box.receiveShadow = true;
      box.castShadow = true;
      return box;
    }
    
    for(let i = 0; i < bufferLen; i += increment){
      const newCube = createVisualizationCube();

      const rad = currAngle * (Math.PI / 180);
      newCube.rotateY(-rad);
      newCube.position.x = radius * Math.cos(rad);
      newCube.position.z = radius * Math.sin(rad);
      
      currAngle += angle;

      this.visualization.add(newCube);
    }
    
    this.scene.add(this.visualization);
    this.visualization.position.z = -18;
    this.visualization.position.y += 2;
    this.visualization.rotateX(Math.PI / 2);
  }
  
  update(){
    const elapsedTime = this.clock.getElapsedTime();
    
    const bufferLength = this.audioManager.analyser.frequencyBinCount;
    const buffer = this.audioManager.buffer;
    const numObjects = this.visualization.children.length;
    const increment = Math.floor(bufferLength / numObjects);
    
    this.audioManager.analyser.getByteFrequencyData(buffer); //getByteTimeDomainData is cool too! :D
    
    const scaleToIsEmpty = this.scaleTo.length === 0;
    const timeInterval = 0.02;
    
    if(elapsedTime - this.lastTime >= timeInterval){
      this.lastTime = elapsedTime;
      
      for(let i = 0; i < numObjects; i++){
        const value = buffer[i * increment] / 255;
        const newVal = value * 12;

        if(scaleToIsEmpty){
          this.scaleTo.push(newVal);
        }else{
          this.scaleTo[i] = newVal;
        }
      }
    }else{
      const lerpAmount = (elapsedTime - this.lastTime) / timeInterval;
      
      for(let i = 0; i < numObjects; i++){
        const value = buffer[i * increment] / 255;
        const newVal = value * 12;
        const obj = this.visualization.children[i];
        //console.log(`i: ${i}, delta x: ${obj.scale.x - newVal}, new val: ${newVal}`);
        
        let valToScaleTo;
        
        if(scaleToIsEmpty){
          this.scaleTo.push(newVal);
          valToScaleTo = newVal;
        }else{
          valToScaleTo = this.scaleTo[i];
        }
      
        obj.scale.lerpVectors(
          obj.scale, 
          new Vector3(valToScaleTo, 1, 1), 
          lerpAmount,
        );
      }
    }
    
    this.visualization.rotateY(Math.PI / 2500);
    
    this.doPostProcessing();
  }
}
