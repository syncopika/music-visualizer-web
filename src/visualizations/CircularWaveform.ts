import { VisualizerBase, ConfigurableParameterRange } from './VisualizerBase';
import { SceneManager } from '../SceneManager';
import { AudioManager } from '../AudioManager';

import {
  Mesh,
  BoxGeometry,
  MeshPhongMaterial,
  Vector3,
  Group,
} from 'three';

export class CircularWaveform extends VisualizerBase {
  numObjects: number;
  visualization: Group;
  lastTime: number;
  moveTo: number[];
  rotationAxis: Vector3;
  radius: number;
  
  constructor(name: string, sceneManager: SceneManager, audioManager: AudioManager, size: number){
    super(name, sceneManager, audioManager);
    this.numObjects = size;
    this.visualization = new Group();
    this.lastTime = this.clock.getElapsedTime();
    this.moveTo = [];
    this.radius = 15;
    
    // add new configurable parameter for changing radius
    this.configurableParams.radius = {value: this.radius, min: 5.0, max: 20.0, step: 0.5, parameterName: 'radius'};

    // generate a random axis to rotate about
    // https://math.stackexchange.com/questions/442418/random-generation-of-rotation-matrices
    const rand1 = Math.random();
    const rand2 = Math.random();
    const theta = Math.acos((2*rand1) - 1);
    const phi = 2 * Math.PI * rand2;
    const x = Math.sin(phi) * Math.cos(theta);
    const y = Math.sin(phi) * Math.sin(theta);
    const z = Math.cos(phi);
    this.rotationAxis = new Vector3(x, y, z);
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
    
    // arrange cubes in a circle
    const radius = this.radius;
    const angle = 360 / numObjects;
    let currAngle = 0;
    
    // if a small analyser.fftSize is chosen, frequencyBinCount will be small as well and
    // so Math.floor(bufferLen / numObjects) may end up being 0
    const increment = Math.max(1, Math.floor(bufferLen / numObjects));

    // TODO: have sphere be an option also?
    const createVisualizationCube = (): Mesh => {
      const boxGeometry = new BoxGeometry(0.2, 0.2, 0.2);
      const color = this.sceneManager.selectedColor ? this.sceneManager.selectedColor : '#aaff00';
      const boxMaterial = new MeshPhongMaterial({color});
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
    this.visualization.position.z = -15;
  }
  
  update(){
    const bufferLength = this.audioManager.analyser.frequencyBinCount;
    const buffer = this.audioManager.buffer;
    const numObjects = this.visualization.children.length;
    const increment = Math.floor(bufferLength / numObjects);
    const angle = 360 / numObjects;
    const radiusSliderVal = (this.configurableParams.radius as ConfigurableParameterRange).value;
    
    if(radiusSliderVal !== this.radius){
      // update radius of visualizer
      let currAngle = 0;
      const newRadius = radiusSliderVal;
      for(let i = 0; i < numObjects; i++){
        const cube = this.visualization.children[i];
        const rad = currAngle * (Math.PI / 180);
        cube.position.x = newRadius * Math.cos(rad);
        cube.position.z = newRadius * Math.sin(rad);
        currAngle += angle;
      }
    }
    
    this.audioManager.analyser.getByteTimeDomainData(buffer);
    
    const moveToIsEmpty = this.moveTo.length === 0;
    const timeInterval = 0.04; // messing with this value can produce some interesting results!
    const elapsedTime = this.clock.getElapsedTime();
    const factor = 5;
    
    if(elapsedTime - this.lastTime >= timeInterval){
      this.lastTime = elapsedTime;
      
      for(let i = 0; i < numObjects; i++){
        const value = buffer[i * increment] / 255;
        const y = value * factor;

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
    
    this.visualization.rotateY(Math.PI / 2000);
    //this.visualization.rotateOnAxis(this.rotationAxis, Math.PI / 2000);
    
    this.doPostProcessing();
  }
}
