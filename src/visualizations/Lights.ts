import { 
  VisualizerBase,
  ConfigurableParameterRange,
  ConfigurableParameterToggle,
} from './VisualizerBase';
import { SceneManager } from '../SceneManager';
import { AudioManager } from '../AudioManager';

import {
  Mesh,
  SphereGeometry,
  MeshStandardMaterial,
  Vector3,
  Group,
  Object3D,
} from 'three';

export class Lights extends VisualizerBase {
  numObjects: number;
  visualization: Group;
  lastTime: number;
  scaleTo: number[];
  
  objectRadius: number;
  
  // set some boundaries to restrict how far the objects can move to (so they will always remain within camera view)
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  
  constructor(name: string, sceneManager: SceneManager, audioManager: AudioManager, size: number){
    super(name, sceneManager, audioManager);
    this.numObjects = size;
    this.visualization = new Group();
    this.lastTime = this.clock.getElapsedTime();
    this.scaleTo = [];
    
    this.configurableParams['speed'] = {
      value: 0.05, 
      min: 0.01, 
      max: 1.0, 
      step: 0.01,
    };
    
    this.objectRadius = 10;
    
    this.minX = -30;
    this.maxX = 30;
    this.minY = -20;
    this.maxY = 20;
    this.minZ = -40; // remember, going into the screen == more negative Z value
    this.maxZ = 10;
    
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
    
    if(this.visualization.children){
      this.visualization = new Group();
    }
    
    const bufferLen = this.audioManager.analyser.frequencyBinCount;
    const numObjects = this.numObjects;
    
    // if a small analyser.fftSize is chosen, frequencyBinCount will be small as well and
    // so Math.floor(bufferLen / numObjects) may end up being 0
    const increment = Math.max(1, Math.floor(bufferLen / numObjects));
    
    const defaultColor = '#2ff109';
    if(!this.sceneManager.selectedColor && this.sceneManager.htmlColorPicker){
      this.sceneManager.htmlColorPicker.value = defaultColor;
    }
    
    const createVisualizationSphere = (): Mesh => {
      const geometry = new SphereGeometry(this.objectRadius, 28, 16);
      
      const color = this.sceneManager.selectedColor ? this.sceneManager.selectedColor : defaultColor;
      
      const material = new MeshStandardMaterial({color, transparent: true});
      const sphere = new Mesh(geometry, material);
      
      sphere.position.set(
        Math.random() * 40 + -15,
        Math.random() * 15 + -5,
        -15
      );
      
      const scale = Math.random() * (0.085 - 0.025) + 0.025;
      sphere.scale.set(scale, scale, scale);
      
      // give the sphere a random velocity
      const randVelocity = new Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, 1);
      randVelocity.normalize();
      
      // @ts-expect-error TS2339
      sphere.velocity = randVelocity;
      
      return sphere;
    };
    
    // TODO: try Poisson disk sampling to distribute the spheres so none of them get placed too close to another?
    // http://devmag.org.za/2009/05/03/poisson-disk-sampling/
    // https://www.jasondavies.com/poisson-disc/
    for(let i = 0; i < bufferLen; i += increment){
      this.visualization.add(createVisualizationSphere());
    }
    
    this.scene.add(this.visualization);
  }
  
  lerp(from: number, to: number, amount: number): number{
    return to + (from - to) * amount;
  }
  
  objectIsOutOfBounds(obj: Object3D): boolean {
    if(obj.position.y > this.maxY || obj.position.y < this.minY || obj.position.x < this.minX || obj.position.x > this.maxX){
      return true;
    }
    return false;
  }
  
  getOutOfBoundsBoundaryNormal(obj: Object3D): Vector3 {
    if(obj.position.y > this.maxY){
      return new Vector3(0, -1, 0); // the top y-axis boundary's normal is pointing downwards
    }
    if(obj.position.y < this.minY){
      return new Vector3(0, 1, 0);
    }
    if(obj.position.x < this.minX){
      return new Vector3(1, 0, 0);
    }
    return new Vector3(-1, 0, 0);
  }
  
  // get the velocity of a sphere object after it "collides" with an out-of-bounds boundary
  // we're assuming a perfectly elastic collision here so the new velocity should be a
  // mirror reflection about the boundary's normal vector.
  // might be helpful: https://github.com/syncopika/learningCpp/blob/master/sdl2projects/asteroids/main.cpp#L254
  getPostCollisionVelocity(object: Object3D, normal: Vector3): Vector3 {
    // @ts-expect-error TS2339
    const objVelocity = object.velocity; // TODO: we might need to make a wrapper around object to provide velocity to avoid adding the typecheck ignore comments
    
    // @ts-expect-error TS2339
    const velocityNormalDotProduct = object.velocity.dot(normal);
    
    const newVelocity = objVelocity.sub(normal.multiplyScalar(2 * velocityNormalDotProduct));
    
    return newVelocity;
  }
  
  update(){
    const elapsedTime = this.clock.getElapsedTime();
    
    const bufferLength = this.audioManager.analyser.frequencyBinCount;
    const buffer = this.audioManager.buffer;
    const numObjects = this.visualization.children.length;
    const increment = Math.floor(bufferLength / numObjects);
    
    this.audioManager.analyser.getByteFrequencyData(buffer);
    
    const scaleToIsEmpty = this.scaleTo.length === 0;
    const timeInterval = 0.03;
    
    if(elapsedTime - this.lastTime >= timeInterval){
      this.lastTime = elapsedTime;
      
      for(let i = 0; i < numObjects; i++){
        const value = buffer[i * increment] / 255;
        const newVal = value ;

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
        const newVal = value;
        const obj = this.visualization.children[i];
        
        let valToScaleTo;
        
        if(scaleToIsEmpty){
          this.scaleTo.push(newVal);
          valToScaleTo = newVal;
        }else{
          valToScaleTo = this.scaleTo[i];
        }
        
        const mat = (obj as Mesh).material as MeshStandardMaterial;
        mat.opacity = this.lerp(mat.opacity, valToScaleTo * 1.1, lerpAmount);
      }
    }
    
    this.visualization.children.forEach(c => {
      const speed = this.configurableParams.speed as ConfigurableParameterRange;
      
      // if child goes out of viewport, adjust
      //
      // should we convert world pos to screen pos and check that?
      // https://stackoverflow.com/questions/11586527/converting-world-coordinates-to-screen-coordinates-in-three-js-using-projection
      // https://www.reddit.com/r/Unity3D/comments/e04hot/how_is_cameraworldtoviewportpoint_implemented/
      if(this.objectIsOutOfBounds(c)){
        const boundaryNormal = this.getOutOfBoundsBoundaryNormal(c);
        const newVelocity = this.getPostCollisionVelocity(c, boundaryNormal);
        // @ts-expect-error TS2339
        c.velocity.copy(newVelocity);
      }
      
      // @ts-expect-error TS2339
      c.position.x += c.velocity.x * speed.value;
      
      // @ts-expect-error TS2339
      c.position.y += c.velocity.y * speed.value;
    });
    
    this.doPostProcessing();
  }
}
