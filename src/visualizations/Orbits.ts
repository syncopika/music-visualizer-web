import { VisualizerBase } from './VisualizerBase';
import { SceneManager } from '../SceneManager';
import { AudioManager } from '../AudioManager';

import {
  Mesh,
  SphereGeometry,
  MeshPhongMaterial,
  Vector3,
  Group,
  Quaternion,
} from 'three';

interface Orbit {
  object: Mesh;
  pathFunction: (time: number) => Vector3; // the function should, given a particular time, generate the next x, y and z positions based on ellipse parametric functions
}

// the idea here is to create multiple elliptical orbits about the origin
// with each orbit containing one sphere traveling along the orbit
// https://math.stackexchange.com/questions/4538624/3d-parametric-equations-for-an-elliptical-orbit-using-inclination-angle
// https://stackoverflow.com/questions/26767512/i-need-an-equation-for-equal-movement-along-an-ellipse
// https://flexbooks.ck12.org/cbook/ck-12-precalculus-concepts-2.0/section/10.3/related/lesson/parametric-equations-for-circles-and-ellipses-calc/
// https://math.stackexchange.com/questions/1897028/ellipse-in-3d-space-tilted-wrt-z-axis
export class Orbits extends VisualizerBase {
  numObjects: number;
  visualization: Group;
  lastTime: number;
  scaleTo: number[];
  orbits: Orbit[];
  
  constructor(name: string, sceneManager: SceneManager, audioManager: AudioManager, size: number){
    super(name, sceneManager, audioManager);
    this.numObjects = size;
    this.visualization = new Group();
    this.lastTime = this.clock.getElapsedTime();
    this.scaleTo = [];
    this.orbits = [];
    
    (this.configurableParams.bloomPass as ConfigurableParameterToggle).isOn = true;
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
    
    const createVisualizationSphere = () => {
      const geometry = new SphereGeometry(10, 28, 16);
      const material = new MeshPhongMaterial({color: '#2f88f5', transparent: true});
      const sphere = new Mesh(geometry, material);
      
      const scale = Math.random() * (0.085 - 0.045) + 0.045;
      sphere.scale.set(scale, scale, scale); //0.08, 0.08, 0.08);
      
      return sphere;
    };
    
    const generateEllipseFunction = (): ((time: number) => Vector3) => {
        const majMax = 40;
        const majMin = 10;
        const minMax = 9;
        const minMin = 2;
        const majAxis = Math.random() * (majMax - majMin) + majMin;
        const minAxis = Math.random() * (minMax - minMin) + minMin;
        const randRotation = new Quaternion();
        randRotation.random();
        
        const factor = Math.random();
        
        return (time: number) => {
          const newXPos = majAxis * Math.cos(factor * time);
          const newYPos = minAxis * Math.sin(factor * time);
          
          // give the ellipse a random rotation about the origin
          const ellipse = new Vector3(newXPos, newYPos, 0);
          ellipse.applyQuaternion(randRotation);
          
          return ellipse;
        }
    };
    
    for(let i = 0; i < bufferLen; i += increment){
      const newSphere = createVisualizationSphere();
      
      const newEllipseFunc = generateEllipseFunction();
      
      // position the new sphere based on ellipse
      const initialPosOnEllipse = newEllipseFunc(0);
      newSphere.position.copy(initialPosOnEllipse);
      
      // generate random elliptical parametric equation about the origin
      const newOrbit = {
        object: newSphere,
        pathFunction: newEllipseFunc,
      };
      
      this.orbits.push(newOrbit);
      
      this.visualization.add(newSphere);
    }
    
    this.scene.add(this.visualization);
    
    this.visualization.position.z = -25;
    this.visualization.position.y += 2.5;
    this.visualization.rotateX(Math.PI / 2);
  }
  
  lerp(from: number, to: number, amount: number): number{
    return to + (from - to) * amount;
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
        
        // set new position based on elliptical path
        const ellipseFunc = this.orbits[i].pathFunction;
        const newPos = ellipseFunc(elapsedTime);
        obj.position.copy(newPos);
        
        // lerp scale
        const lerpTo = new Vector3();
        lerpTo
          .copy(obj.scale)
          .normalize()
          .multiplyScalar(valToScaleTo * 0.02);
        
        obj.scale.lerpVectors(
          obj.scale,
          lerpTo, 
          lerpAmount,
        );
        
        const mat = (obj as Mesh).material as MeshPhongMaterial;
        mat.opacity = this.lerp(mat.opacity, valToScaleTo * 1.1, lerpAmount);
      }
    }
    
    this.visualization.rotateZ(Math.PI / 500);
    
    this.doPostProcessing();
  }
}
