import { VisualizerBase } from './VisualizerBase';
import { SceneManager } from '../SceneManager';
import { AudioManager } from '../AudioManager';

import {
  Mesh,
  SphereGeometry,
  MeshPhongMaterial,
  Vector3,
  Group,
} from 'three';

export class Spheres extends VisualizerBase {
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
    
    const createVisualizationSphere = (position: Vector3) => {
      const geometry = new SphereGeometry(10, 28, 16);
      const material = new MeshPhongMaterial({color: '#2f88f5', transparent: true});
      const sphere = new Mesh(geometry, material);
      
      sphere.position.copy(position.normalize());
      
      const scale = Math.random() * (0.085 - 0.045) + 0.045;
      sphere.scale.set(scale, scale, scale); //0.08, 0.08, 0.08);
      
      return sphere;
    };
    
    const getRandomVertex = (geometry: SphereGeometry) => {
      const verts = geometry.attributes.position.array;
      const numVertices = verts.length / 3;
      const randVertIdx = Math.floor(Math.random() * numVertices) * 3;
      return new Vector3(verts[randVertIdx], verts[randVertIdx + 1], verts[randVertIdx + 2]);
    }
    
    const skeletonGeometry = new SphereGeometry(15, 32, 16);
    
    for(let i = 0; i < bufferLen; i += increment){
      // TODO: get a random vertex but uniformly distributed?
      // https://mathworld.wolfram.com/SpherePointPicking.html
      // https://corysimon.github.io/articles/uniformdistn-on-sphere/
      const spherePos = getRandomVertex(skeletonGeometry);
      this.visualization.add(createVisualizationSphere(spherePos));
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
          .multiplyScalar(valToScaleTo * 2.1);
        
        obj.position.lerpVectors(
          obj.position,
          lerpTo, 
          lerpAmount,
        );
        
        const mat = (obj as Mesh).material as MeshPhongMaterial;
        mat.opacity = obj.position.distanceTo(new Vector3(0, 0, 0)) / 10;
        //console.log(obj.material.opacity);
      }
    }
    
    this.visualization.rotateZ(Math.PI / 500);
  }
}
