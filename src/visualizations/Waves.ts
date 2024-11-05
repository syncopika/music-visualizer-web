import { VisualizerBase } from './VisualizerBase';
import { SceneManager } from '../SceneManager';
import { AudioManager } from '../AudioManager';

/* 
ideas:
- opacity of cubes depends on distance to camera. the closer, the more transparent
- cube color gradient based on y-pos

*/

import {
  Mesh,
  BoxGeometry,
  MeshPhongMaterial,
  Vector3,
  Group,
  //Color,
} from 'three';

export class Waves extends VisualizerBase {
  numObjects: number;
  visualization: Group;
  columns: number;
  lastTime: number;
  scaleTo: number[];
  zSeparation: number;
  xSeparation: number;
  
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
    this.zSeparation = -6; // how separated the cubes are along the z-axis
    this.xSeparation = 3; // how separated the cubes are along the x-axis
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
    
    const numObjects = this.numObjects;

    function createVisualizationCube(): Mesh {
      const boxGeometry = new BoxGeometry(0.1, 0.2, 0.1);
      const boxMaterial = new MeshPhongMaterial({color: '#ffffdd'}); // TODO: color gradient?
      const box = new Mesh(boxGeometry, boxMaterial);
      box.receiveShadow = true;
      box.castShadow = true;
      return box;
    }
    
    let currZ = 0;
    
    for(let i = 0; i < numObjects; i++){
      const newRow = new Group();
      
      let currX = -20;
      
      for(let j = 0; j < this.columns; j++){
        const newCube = createVisualizationCube();
        
        newCube.position.x = currX;
        newCube.position.z = currZ;
        
        // hacky but helpful to record initial y pos to use when determining next y position
        // @ts-expect-error: TS2339
        newCube.intialYPos = -5;
        
        newRow.add(newCube);
        
        currX += this.xSeparation;
      }
      
      currZ += this.zSeparation;
      
      this.visualization.add(newRow);
    }
    
    this.scene.add(this.visualization);
    
    this.visualization.position.y -= 2; // TODO: make y pos configurable?
  }
  
  update(){
    const elapsedTime = this.clock.getElapsedTime();
    
    const bufferLength = this.audioManager.analyser.frequencyBinCount;
    const buffer = this.audioManager.buffer;
    const numObjects = this.numObjects;
    const increment = Math.floor(bufferLength / numObjects);
    const rows = this.visualization.children;
    
    this.audioManager.analyser.getByteTimeDomainData(buffer);
    
    const scaleToIsEmpty = this.scaleTo.length === 0;
    const timeInterval = 0.08;
    const factor = 12;
    
    if(elapsedTime - this.lastTime >= timeInterval){
      this.lastTime = elapsedTime;
      
      // set up next scaleTo value for each row of cubes
      for(let i = 0; i < numObjects; i++){
        const value = buffer[i * increment] / 255;
        const newVal = value * factor;

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
        const newVal = value * factor;
        
        for(let j = 0; j < this.columns; j++){
          const obj = rows[i].children[j];
          
          let valToScaleTo;
          
          if(scaleToIsEmpty){
            this.scaleTo.push(newVal);
            valToScaleTo = newVal;
          }else{
            valToScaleTo = this.scaleTo[i];
          }
        
          obj.position.lerpVectors(
            obj.position,
            // @ts-expect-error: TS2339
            new Vector3(obj.position.x, valToScaleTo + obj.intialYPos, obj.position.z), 
            lerpAmount,
          );
        }
      }
    }
    
    // move all cubes forward
    rows.forEach((row, idx) => {
      for(let i = 0; i < this.columns; i++){
        const cube = row.children[i];
        
        cube.position.z += 0.1; // TODO: make this configurable by the user
        
        if(cube.position.z > this.camera.position.z + 20){
          //cube.material.color = new Color('#000000');
          if(idx === 0){
            cube.position.z = rows[rows.length - 1].children[0].position.z + this.zSeparation; // all cubes in a row should have the same z position
          }else{
            cube.position.z = rows[idx - 1].children[0].position.z + this.zSeparation;
          }
        }
      }
    });
  }
}
