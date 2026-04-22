import { VisualizerBase, ConfigurableParameterRange } from './VisualizerBase';
import { SceneManager } from '../SceneManager';
import { AudioManager } from '../AudioManager';

import {
  LineBasicMaterial,
  LineLoop,
  BufferGeometry,
  Vector3,
  Color,
} from 'three';

export class LineWaveform extends VisualizerBase {
  numObjects: number;
  visualization: LineLoop;
  lastTime: number;
  moveTo: number[];
  rotationAxis: Vector3;
  radius: number;
  points: Vector3[];
  
  constructor(name: string, sceneManager: SceneManager, audioManager: AudioManager, size: number){
    super(name, sceneManager, audioManager);
    this.numObjects = size;
    this.visualization = new LineLoop();
    this.lastTime = this.clock.getElapsedTime();
    this.moveTo = [];
    this.radius = 15;
    this.points = [];
    
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
    
    // if a small analyser.fftSize is chosen, frequencyBinCount will be small as well and
    // so Math.floor(bufferLen / numObjects) may end up being 0
    const increment = Math.max(1, Math.floor(bufferLen / numObjects));

    // arrange line points in a circle
    const radius = this.radius;
    const angle = 360 / numObjects;
    let currAngle = 0;

    for(let i = 0; i < bufferLen; i += increment){
      const rad = currAngle * (Math.PI / 180);
      const newPoint = new Vector3(radius * Math.cos(rad), radius * Math.sin(rad), 0);
      this.points.push(newPoint);
      currAngle += angle;
    }
    
    const material = new LineBasicMaterial({color: 0x00ff00});
    const geometry = new BufferGeometry().setFromPoints(this.points);
    
    // since we're interested in creating a circle, we can use LineLoop instead of Line
    const line = new LineLoop(geometry, material);
    
    this.visualization = line;
    
    this.scene.add(this.visualization);
    this.visualization.position.z = -25;
  }
  
  changeVisualizationColor(newColor: string){
    (this.visualization.material as LineBasicMaterial).color = new Color(newColor);
  }
  
  update(){
    const bufferLength = this.audioManager.analyser.frequencyBinCount;
    const buffer = this.audioManager.buffer;
    const numObjects = this.numObjects; // num vertices in this case
    const increment = Math.floor(bufferLength / numObjects);
    const angle = 360 / numObjects;
    const radiusSliderVal = (this.configurableParams.radius as ConfigurableParameterRange).value;
    
    if(radiusSliderVal !== this.radius){
      // update radius of visualizer
      let currAngle = 0;
      const newRadius = radiusSliderVal;
      const visualizerVertexPositions = this.visualization.geometry.attributes.position;
      for(let i = 0; i < this.points.length; i++){
        const rad = currAngle * (Math.PI / 180);
        const x = newRadius * Math.cos(rad);
        const y = newRadius * Math.sin(rad);
        const z = visualizerVertexPositions.getZ(i);
        visualizerVertexPositions.setXYZ(i, x, y, z);
        currAngle += angle;
      }
      visualizerVertexPositions.needsUpdate = true;
      console.log('updated radius');
      this.radius = newRadius;
    }
    
    this.audioManager.analyser.getByteTimeDomainData(buffer);
    
    const moveToIsEmpty = this.moveTo.length === 0;
    const timeInterval = 0.04; // messing with this value can produce some interesting results!
    const elapsedTime = this.clock.getElapsedTime();
    const factor = 8;
    
    if(elapsedTime - this.lastTime >= timeInterval){
      this.lastTime = elapsedTime;
      
      for(let i = 0; i < this.points.length; i++){
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
      
      const visualizerVertexPositions = this.visualization.geometry.attributes.position;
      
      for(let i = 0; i < this.points.length; i++){
        const value = buffer[i * increment] / 255;
        const y = value * factor;
        
        let valToMoveTo;
        
        if(moveToIsEmpty){
          this.moveTo.push(y);
          valToMoveTo = y;
        }else{
          valToMoveTo = this.moveTo[i];
        }
        
        const currX = visualizerVertexPositions.getX(i);
        const currY = visualizerVertexPositions.getY(i);
        const currZ = visualizerVertexPositions.getZ(i);
        const currPos = new Vector3(currX, currY, currZ); 
        const newPos = new Vector3(currX, currY, valToMoveTo); // TODO: explore setting valToMoveTo for different axes?
        
        currPos.lerpVectors(currPos, newPos, lerpAmount);
        
        visualizerVertexPositions.setXYZ(i, currPos.x, currPos.y, currPos.z);
        visualizerVertexPositions.needsUpdate = true;
      }
    }
    
    //this.visualization.rotateY(Math.PI / 2000);
    this.visualization.rotateOnAxis(this.rotationAxis, Math.PI / 2000);
    
    this.doPostProcessing();
  }
}
