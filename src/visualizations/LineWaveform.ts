import {
  VisualizerBase,
  ConfigurableParameterRange,
  ConfigurableParameterToggle,
} from './VisualizerBase';
import { SceneManager } from '../SceneManager';
import { AudioManager } from '../AudioManager';

import {
  LineBasicMaterial,
  LineDashedMaterial,
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
  rotationSpeed: number;
  points: Vector3[];
  lineMaterial: LineBasicMaterial;
  dashLineMaterial: LineDashedMaterial;
  
  constructor(name: string, sceneManager: SceneManager, audioManager: AudioManager, size: number){
    super(name, sceneManager, audioManager);
    this.numObjects = size;
    this.visualization = new LineLoop();
    this.lastTime = this.clock.getElapsedTime();
    this.moveTo = [];
    this.radius = 15;
    this.rotationSpeed = 0.0;
    this.points = [];
    
    if(!this.sceneManager.selectedColor && this.sceneManager.htmlColorPicker){
      this.sceneManager.htmlColorPicker.value = '#00ff00';
    }
    const color = this.sceneManager.selectedColor ? this.sceneManager.selectedColor : 0x00ff00;
    
    const material = new LineBasicMaterial({color, transparent: true, opacity: 1.0});
    this.lineMaterial = material;
    
    const dashedLineMaterial = new LineDashedMaterial({color, transparent: true, opacity: 1.0, scale: 1, dashSize: 3, gapSize: 1});
    this.dashLineMaterial = dashedLineMaterial;
    
    // add new configurable parameter for changing radius
    this.configurableParams.radius = {value: this.radius, min: 5.0, max: 20.0, step: 0.5, parameterName: 'radius'};
    
    // add new configurable parameter for changing rotation speed
    this.configurableParams.rotationSpeed = {value: this.rotationSpeed, min: 0.0, max: 0.1, step: 0.001, parameterName: 'rotationSpeed'};

    // add new configurable parameter for direction each vertex should be moved to for the visualization
    // in x-y plane or along z-axis
    this.configurableParams.moveVerticesAlongXYPlane = {isOn: false, parameterName: 'moveVerticesAlongXYPlane'};

    // toggle for line opacity
    this.configurableParams.opacityOn = {isOn: false, parameterName: 'lineOpacity'};
    
    // toggle dashed or solid lines
    this.configurableParams.dashedLine = {isOn: false, parameterName: 'dashedLine'};

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
  
  lerp(from: number, to: number, amount: number): number{
    return to + (from - to) * amount;
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
    
    this.points = [];
    
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
    
    const geometry = new BufferGeometry().setFromPoints(this.points);
    
    // since we're interested in creating a circle, we can use LineLoop instead of Line
    const line = new LineLoop(geometry, this.lineMaterial);
    
    this.visualization = line;
    
    this.scene.add(this.visualization);
    this.visualization.position.z = -30;
  }
  
  changeVisualizationColor(newColor: string){
    (this.lineMaterial as LineBasicMaterial).color = new Color(newColor);
    (this.dashLineMaterial as LineDashedMaterial).color = new Color(newColor);
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
    
    const isDashedLine = (this.configurableParams.dashedLine as ConfigurableParameterToggle).isOn;
    this.visualization.material = isDashedLine ? this.dashLineMaterial : this.lineMaterial; 
    if(isDashedLine){
      this.visualization.computeLineDistances();
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
      
      let currAngle = 0;
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
        
        let newPos;
        const rad = currAngle * (Math.PI / 180);
        if((this.configurableParams.moveVerticesAlongXYPlane as ConfigurableParameterToggle).isOn){
          const newX = (this.radius + valToMoveTo) * Math.cos(rad);
          const newY = (this.radius + valToMoveTo) * Math.sin(rad);
          newPos = new Vector3(newX, newY, currZ);
        }else{
          const newX = this.radius * Math.cos(rad);
          const newY = this.radius * Math.sin(rad);
          newPos = new Vector3(newX, newY, valToMoveTo);
        }
        
        currPos.lerpVectors(currPos, newPos, lerpAmount);
        
        visualizerVertexPositions.setXYZ(i, currPos.x, currPos.y, currPos.z);
        visualizerVertexPositions.needsUpdate = true;
        
        const mat = (this.visualization.material as LineBasicMaterial);
        //console.log(valToMoveTo);
        
        // ~4 seems to be a pretty good number; the range of valToMoveTo seems pretty consistent interestingly, something to investigate??
        if((this.configurableParams.opacityOn as ConfigurableParameterToggle).isOn){
          mat.opacity = this.lerp(mat.opacity, (valToMoveTo - 3.8), lerpAmount);
        }else{
          mat.opacity = 1.0;
        }
        
        currAngle += angle;
      }
    }
    
    //this.visualization.rotateY(Math.PI / 2000);
    const speed = (this.configurableParams.rotationSpeed as ConfigurableParameterRange).value;
    this.visualization.rotateOnAxis(this.rotationAxis, speed);
    
    this.doPostProcessing();
  }
}
