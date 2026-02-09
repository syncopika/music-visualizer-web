import { VisualizerBase } from './VisualizerBase';
import { SceneManager } from '../SceneManager';
import { AudioManager } from '../AudioManager';

import {
  Mesh,
  BoxGeometry,
  SphereGeometry,
  MeshPhongMaterial,
  Vector3,
  Group,
} from 'three';

export class SphericalCubes extends VisualizerBase {
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
    
    const createVisualizationCube = (position: Vector3): Mesh => {
      const boxGeometry = new BoxGeometry(0.4, 0.4, 0.4);
      const color = this.sceneManager.selectedColor ? this.sceneManager.selectedColor : '#ffffdd';
      const boxMaterial = new MeshPhongMaterial({color}); // TODO: color gradient?
      const box = new Mesh(boxGeometry, boxMaterial);
      box.receiveShadow = true;
      box.castShadow = true;
      
      box.position.copy(position);
      
      // orient the box to face the direction of the vector created from origin -> position (e.g. forward vector)
      const lookAtPoint = position.normalize();
      box.lookAt(lookAtPoint);
      
      return box;
    };
    
    const getRandomVertex = (geometry: SphereGeometry): Vector3 => {
      const verts = geometry.attributes.position.array;
      const numVertices = verts.length / 3;
      const randVertIdx = Math.floor(Math.random() * numVertices) * 3;
      return new Vector3(verts[randVertIdx], verts[randVertIdx + 1], verts[randVertIdx + 2]);
    }
    
    const skeletonGeometry = new SphereGeometry(20, 32, 16);
    
    for(let i = 0; i < bufferLen; i += increment){
      // TODO: get a random vertex but uniformly distributed?
      // https://mathworld.wolfram.com/SpherePointPicking.html
      // https://corysimon.github.io/articles/uniformdistn-on-sphere/
      // arrange cubes in a sphere
      const spherePos = getRandomVertex(skeletonGeometry);
      this.visualization.add(createVisualizationCube(spherePos));
    }
    
    this.scene.add(this.visualization);
    
    this.visualization.position.z = -25;
    this.visualization.position.y += 2.5;
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
        
        let valToScaleTo;
        
        if(scaleToIsEmpty){
          this.scaleTo.push(newVal);
          valToScaleTo = newVal;
        }else{
          valToScaleTo = this.scaleTo[i];
        }
        
        obj.scale.lerpVectors(
          obj.scale, 
          new Vector3(1, 1, valToScaleTo), // scale on cube's local z axis, which should correspond to the direction the cube is facing
          lerpAmount,
        );
      }
    }
    
    this.visualization.rotateY(Math.PI / 2500);
    
    this.doPostProcessing();
  }
}
