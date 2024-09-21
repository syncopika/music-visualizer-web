import { VisualizerBase } from './VisualizerBase';

import { AudioManager } from '../AudioManager';

import {
  Scene, 
  Mesh,
  SphereGeometry,
  MeshPhongMaterial,
  Vector3,
  Group,
  Clock,
} from 'three';

export class Spheres extends VisualizerBase {
  numObjects: number;
  visualization: Group;
  clock: Clock;
  lastTime: number;
  scaleTo: number[];
  
  constructor(name: string, clock: Clock, scene: Scene, audioManager: AudioManager, size: number){
    super(name, scene, audioManager);
    this.numObjects = size;
    this.visualization = new Group();
    this.clock = clock;
    this.lastTime = clock.getElapsedTime();
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
    const increment = Math.floor(bufferLen / numObjects);
    
    const createVisualizationSphere = (position: Vector3) => {
      const geometry = new SphereGeometry(10, 28, 16);
      const material = new MeshPhongMaterial({color: '#2f88f5'});
      const sphere = new Mesh(geometry, material);
      sphere.position.copy(position);
      sphere.scale.set(0.08, 0.08, 0.08);
      return sphere;
    };
    
    const getRandomVertex = (geometry: SphereGeometry) => {
      const verts = geometry.attributes.position.array;
      const numVertices = verts.length / 3;
      const randVertIdx = Math.floor(Math.random() * numVertices);
      return new Vector3(verts[randVertIdx], verts[randVertIdx + 1], verts[randVertIdx + 2]);
    }
    
    const skeletonGeometry = new SphereGeometry(15, 32, 16);
    
    for(let i = 0; i < bufferLen; i += increment){
      const spherePos = getRandomVertex(skeletonGeometry);
      this.visualization.add(createVisualizationSphere(spherePos));
    }
    
    this.scene.add(this.visualization);
    
    this.visualization.position.z = -25;
    this.visualization.position.y += 3;
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
        
        const lerpTo = new Vector3();
        lerpTo
          .copy(obj.position)
          .normalize()
          .multiplyScalar(valToScaleTo);
        
        obj.position.lerpVectors(
          obj.position,
          lerpTo, 
          lerpAmount,
        );
        
      }
    }
    
    this.visualization.rotateZ(Math.PI / 2500);
  }
}
