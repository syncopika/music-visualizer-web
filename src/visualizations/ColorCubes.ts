import { VisualizerBase } from './VisualizerBase';
import { SceneManager } from '../SceneManager';
import { AudioManager } from '../AudioManager';

import {
  Mesh,
  BoxGeometry,
  ShaderMaterial,
  Vector3,
  Group,
  Color,
} from 'three';

export class ColorCubes extends VisualizerBase {
  numObjects: number;
  visualization: Group;
  lastTime: number;
  scaleTo: number[];
  rotationAxis: Vector3;
  initialPos: Vector3[];
  startColor: string; // hex color string
  endColor: string;   // hex color string
  
  constructor(name: string, sceneManager: SceneManager, audioManager: AudioManager, size: number){
    super(name, sceneManager, audioManager);
    this.numObjects = size;
    this.visualization = new Group();
    this.lastTime = this.clock.getElapsedTime();
    this.scaleTo = [];
    this.startColor = '#caf0f8';
    this.endColor = '#023e8a';
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
    
    // TODO: hook this up with this.startColor (and make another one for endColor)?
    const defaultColor = '#ffffdd';
    if(!this.sceneManager.selectedColor && this.sceneManager.htmlColorPicker){
      this.sceneManager.htmlColorPicker.value = defaultColor;
    }
    
    const createVisualizationCube = (position: Vector3): Mesh => {
      const boxGeometry = new BoxGeometry(0.4, 0.4, 0.4);
      const shaderMaterial = new ShaderMaterial({
        vertexShader: `
          varying vec2 vUv;
          void  main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec2 vUv;
          uniform float uFactor;
          uniform float uOpacity;
          uniform vec3 uStartColor;
          uniform vec3 uEndColor;
          
          void main() {
            // lerp color given a start and end color
            vec3 newColor = mix(uStartColor, uEndColor, uFactor);
            gl_FragColor = vec4(newColor.r, newColor.g, newColor.b, 1.0);
          }
        `,
        uniforms: {
          uFactor: {value: 0.0},
          uOpacity: {value: 1.0},
          uStartColor: {value: new Color(this.startColor)},
          uEndColor: {value: new Color(this.endColor)},
        },
        transparent: true, // necessary for alpha channel
      });
      
      const box = new Mesh(boxGeometry, shaderMaterial);
      
      box.position.copy(position);
      
      return box;
    };
    
    // position the cubes in a square array
    const xDist = 2;
    const yDist = 2;
    let currY = 12;
    const rowStartX = -10;
    let currX = rowStartX;
    let currRowCubeCount = 0;
    const numCubesPerRow = 10;
    for(let i = 0; i < bufferLen; i += increment){
      if(numCubesPerRow === currRowCubeCount){
        // we've filled out a row, move to next
        currX = rowStartX;
        currY -= yDist;
        currRowCubeCount = 0;
      }
      
      const cubePos = new Vector3(currX, currY, 0);
      this.visualization.add(createVisualizationCube(cubePos));
      
      currX += xDist;
      currRowCubeCount++;
    }
    
    this.scene.add(this.visualization);
    
    this.visualization.position.z = -25;
    this.visualization.position.y += 2.5;
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
        const newVal = value * 6;

        if(scaleToIsEmpty){
          this.scaleTo.push(newVal);
        }else{
          this.scaleTo[i] = newVal;
        }
      }
    }else{
      //const lerpAmount = (elapsedTime - this.lastTime) / timeInterval;
      
      for(let i = 0; i < numObjects; i++){
        const value = buffer[i * increment] / 255;
        const newVal = value * 6;
        const obj = this.visualization.children[i];
        
        let valToScaleTo;
        
        if(scaleToIsEmpty){
          this.scaleTo.push(newVal);
          valToScaleTo = newVal;
        }else{
          valToScaleTo = this.scaleTo[i];
        }
        
        const lerpTo = new Vector3();
        lerpTo
          .copy(obj.scale)
          .normalize()
          .multiplyScalar(valToScaleTo * 1.5);
        
        // TODO: lerp the current color between startColor and endColor
        const shaderMat = (obj as Mesh).material as ShaderMaterial;
        //shaderMat.uniforms.uStartColor.value = new Color(this.startColor),
        //shaderMat.uniforms.uEndColor.value = new Color(this.endColor),
        shaderMat.uniforms.uFactor.value = 0.5 * lerpTo.y;
        shaderMat.uniforms.uOpacity.value = 0.3 * lerpTo.y;
      }
    }
    
    this.visualization.rotateY(Math.PI / 2000);
    
    this.doPostProcessing();
  }
}
