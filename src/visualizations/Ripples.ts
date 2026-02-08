import { ConfigurableParameterToggle, VisualizerBase } from './VisualizerBase';
import { SceneManager } from '../SceneManager';
import { AudioManager } from '../AudioManager';

import {
  Mesh,
  CircleGeometry,
  MeshPhongMaterial,
  ShaderMaterial,
  Vector3,
  Group,
} from 'three';

export class Ripples extends VisualizerBase {
  numObjects: number;
  visualization: Group;
  lastTime: number;
  scaleTo: number[];
  
  // keep track of each object's shader + non-shader materials
  // we need to keep track of them individually, otherwise all the objects
  // would be using the same material object, which isn't what we want here
  objectNonShaderMaterial: MeshPhongMaterial[];
  objectShaderMaterial: ShaderMaterial[];
  
  constructor(name: string, sceneManager: SceneManager, audioManager: AudioManager, size: number){
    super(name, sceneManager, audioManager);
    this.numObjects = size;
    this.visualization = new Group();
    this.lastTime = this.clock.getElapsedTime();
    this.scaleTo = [];
    this.objectNonShaderMaterial = [];
    this.objectShaderMaterial = [];
    
    // add new configurable param for toggling material opacity
    this.configurableParams.toggleMaterialOpacity = {isOn: true, parameterName: 'toggleMaterialOpacity'};
    
    // add new configurable param for toggling shader or non-shader material
    // the shader material gives the closest 'ripple' effect atm so it's the default
    this.configurableParams.rippleShaderMaterialOn = {isOn: true, parameterName: 'rippleShaderMaterialOn'};
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
      const color = this.sceneManager.selectedColor ? this.sceneManager.selectedColor : '#2f88f5';
      const material = new MeshPhongMaterial({color, transparent: true});
      this.objectNonShaderMaterial.push(material);
      
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
          void main() {
            // distance from center
            float strength = distance(vUv, vec2(0.5));
            
            // the alpha color of the circle will be based on distance from center
            // the closer to the center of the circle, the more transparent
            float colorAlpha = smoothstep(0.45, 0.5, strength);
            
            gl_FragColor = vec4(.184, .533, .960, colorAlpha); // #2f88f5
          }
        `,
        transparent: true, // necessary for alpha channel
      });
      this.objectShaderMaterial.push(shaderMaterial);
      
      // use shader material by default
      const ripple = new Mesh(geometry, shaderMaterial);
      
      ripple.position.copy(position);
      
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
      // scale the ripple disc meshes so they can stretch to help give a ripple effect
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
        
        const rippleMaterialOn = (this.configurableParams.rippleShaderMaterialOn as ConfigurableParameterToggle).isOn;
        if(rippleMaterialOn){
          (obj as Mesh).material = this.objectShaderMaterial[i];
        }else{
          (obj as Mesh).material = this.objectNonShaderMaterial[i];
        }
        
        const mat = (obj as Mesh).material as MeshPhongMaterial;
        if((this.configurableParams.toggleMaterialOpacity as ConfigurableParameterToggle).isOn){
          mat.opacity = obj.scale.distanceTo(new Vector3(0, 0, 0)) / 10;
        }else{
          mat.opacity = 1.0
        }
      }
    }
    
    //this.visualization.rotateZ(Math.PI / 500);
    
    this.doPostProcessing();
  }
}
