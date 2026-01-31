import { VisualizerBase } from './VisualizerBase';
import { SceneManager } from '../SceneManager';
import { AudioManager } from '../AudioManager';

import {
  Mesh,
  CircleGeometry,
  MeshPhongMaterial,
  Vector3,
  Group,
} from 'three';

export class Ripples extends VisualizerBase {
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
    
    // fix z-position of light (otherwise the ripples will look black)
    // TODO: make sure light control slider for z axis is adjusted!
    this.sceneManager.light.position.z = 50;
    
    const bufferLen = this.audioManager.analyser.frequencyBinCount;
    const numObjects = this.numObjects;
    
    // if a small analyser.fftSize is chosen, frequencyBinCount will be small as well and
    // so Math.floor(bufferLen / numObjects) may end up being 0
    const increment = Math.max(1, Math.floor(bufferLen / numObjects));
    
    const createRipple = (position: Vector3): Mesh => {
      const geometry = new CircleGeometry(5, 32);
      const material = new MeshPhongMaterial({color: '#2f88f5', transparent: true});
      const ripple = new Mesh(geometry, material);
      
      ripple.position.copy(position);
      
      //const scale = Math.random() * (0.085 - 0.045) + 0.045;
      //ripple.scale.set(scale, scale, scale); //0.08, 0.08, 0.08);
      
      return ripple;
    };
    
    const getRandomPos = (): Vector3 => {
      const randomX = Math.floor(Math.random() * 200) - 100; // between -100 and 100
      const randomY = Math.floor(Math.random() * 100) - 50;
      return new Vector3(randomX, randomY, -100);
    }
    
    for(let i = 0; i < bufferLen; i += increment){
      const ripplePos = getRandomPos();
      this.visualization.add(createRipple(ripplePos));
    }
    
    this.scene.add(this.visualization);
    
    this.visualization.position.z = -25;
    this.visualization.position.y += 2.5;
    //this.visualization.rotateX(Math.PI / 2);
    
    console.log(this.scene);
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
      // scale the ripple disc meshes to give a ripple effect (expanding outwards)
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
          .copy(obj.scale)
          .normalize()
          .multiplyScalar(valToScaleTo * 1.5); // TODO: make this factor adjustable?
        
        obj.scale.lerpVectors(
          obj.scale,
          lerpTo,
          lerpAmount,
        );
        
        const mat = (obj as Mesh).material as MeshPhongMaterial;
        mat.opacity = obj.position.distanceTo(new Vector3(0, 0, 0)) / 10;
        //console.log(obj.material.opacity);
      }
    }
    
    //this.visualization.rotateZ(Math.PI / 500);
    
    this.doPostProcessing();
  }
}
