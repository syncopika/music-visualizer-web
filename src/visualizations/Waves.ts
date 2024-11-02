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

export class Waves extends VisualizerBase {
  numObjects: number;
  visualization: Group;
  columns: number;
  lastTime: number;
  scaleTo: number[];
  
  constructor(
    name: string, 
    sceneManager: SceneManager,
    audioManager: AudioManager, 
    size: number,
    columns?: number
  ){
    super(name, sceneManager, audioManager);
    this.numObjects = size;
    this.visualization = new Group();
    this.lastTime = this.clock.getElapsedTime();
    this.scaleTo = [];
    this.columns = columns || 15;
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

    function createVisualizationCube(): Mesh {
      const boxGeometry = new BoxGeometry(0.2, 0.4, 0.2);
      const boxMaterial = new MeshPhongMaterial({color: '#ffffdd'}); // TODO: color gradient?
      const box = new Mesh(boxGeometry, boxMaterial);
      box.receiveShadow = true;
      box.castShadow = true;
      return box;
    }
    
    let currX = -20;
    
    for(let c = 0; c < this.columns; c++){
      const newCol = new Group();
      
      let currZ = 0;
      
      // TODO:
      // set column colors as gradient?
      
      for(let i = 0; i < bufferLen; i += increment){
        const newCube = createVisualizationCube();
        
        newCube.position.x = currX;
        newCube.position.z = currZ;
        newCube.position.y = 0;//Math.sin(Math.PI * deg / 180) * maxY;
        
        // gonna do something a bit hacky here so we can record
        // the initial z position of each cube, which we can use
        // when resetting z position
        // @ts-expect-error: TS2339
        newCube.initialZPos = currZ; // TODO: this is not right I think. maybe take the world position instead and record/use that (also record this value after adding to parent?)

        newCol.add(newCube);
        
        currZ -= 10;
      }
      
      this.visualization.add(newCol);
      
      currX += 3;
    }
    
    this.scene.add(this.visualization);
    this.visualization.position.y -= 5;
    //this.visualization.rotateY(Math.PI / 2);
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
    
    // move all cubes forward
    const cols = this.visualization.children;
    for(const col of cols){
      for(let i = 0; i < numObjects; i++){
        const cube = col.children[i];
        
        cube.position.z += 0.04; // TODO: make this configurable by the user
        
        if(cube.position.z > this.camera.position.z + 15){
          //cube.material.color = new Color('#000000');
          // @ts-expect-error: TS2339
          cube.position.z = cube.initialZPos; // TODO: should be initial world pos
        }
      }
    }
  }
}
