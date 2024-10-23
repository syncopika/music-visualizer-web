import { VisualizerBase } from './VisualizerBase';

import { AudioManager } from '../AudioManager';

import {
  Scene, 
  Mesh,
  BoxGeometry,
  MeshPhongMaterial,
  Vector3,
  Group,
  Clock,
} from 'three';

export class Waves extends VisualizerBase {
  numObjects: number;
  visualization: Group;
  columns: number;
  clock: Clock;
  lastTime: number;
  scaleTo: number[];
  
  constructor(
    name: string, 
    clock: Clock, 
    scene: Scene, 
    audioManager: AudioManager, 
    size: number,
    columns?: number
  ){
    super(name, scene, audioManager);
    this.numObjects = size;
    this.visualization = new Group();
    this.clock = clock;
    this.lastTime = clock.getElapsedTime();
    this.scaleTo = [];
    this.columns = columns || 10;
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

    function createVisualizationCube(){
      const boxGeometry = new BoxGeometry(0.2, 0.4, 0.4);
      const boxMaterial = new MeshPhongMaterial({color: '#ffffdd'}); // TODO: color gradient?
      const box = new Mesh(boxGeometry, boxMaterial);
      box.receiveShadow = true;
      box.castShadow = true;
      return box;
    }
    
    let currZ = 0;
    
    for(let c = 0; c < this.columns; c++){
      const newCol = new Group();
      
      let currX = -30;
      
      // TODO:
      // set column colors as gradient?
      
      //let deg = 0;
      //const maxY = 10;
      
      for(let i = 0; i < bufferLen; i += increment){
        const newCube = createVisualizationCube();
        
        newCube.position.x = currX;
        newCube.position.z = currZ;
        newCube.position.y = 0;//Math.sin(Math.PI * deg / 180) * maxY;

        newCol.add(newCube);
        
        currX += 3;
        //deg += (360 / numObjects);
      }
      
      this.visualization.add(newCol);
      
      currZ -= 10;
    }
    
    this.scene.add(this.visualization);
    this.visualization.position.z = -50;
    this.visualization.position.x += 50;
    this.visualization.position.y -= 5;
    this.visualization.rotateY(Math.PI / 2);
  }
  
  update(){
    const elapsedTime = this.clock.getElapsedTime();
    
    const bufferLength = this.audioManager.analyser.frequencyBinCount;
    const buffer = this.audioManager.buffer;
    const numObjects = this.numObjects;
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
      
      const cols = this.visualization.children;
      for(const col of cols){
        for(let i = 0; i < numObjects; i++){
          const value = buffer[i * increment] / 255;
          const newVal = value * 12;
          const obj = col.children[i];
          
          let valToScaleTo;
          
          if(scaleToIsEmpty){
            this.scaleTo.push(newVal);
            valToScaleTo = newVal;
          }else{
            valToScaleTo = this.scaleTo[i];
          }
        
          obj.position.lerpVectors(
            obj.position, 
            new Vector3(obj.position.x, valToScaleTo, obj.position.z), 
            lerpAmount,
          );
        }
      }
    }
    
    this.visualization.position.z += 0.04;
    if(this.visualization.position.z > 100){
      this.visualization.position.z = -50;
    }
  }
}
