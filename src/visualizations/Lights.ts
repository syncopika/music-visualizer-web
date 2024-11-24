import { 
  VisualizerBase,
  ConfigurableParameterRange,
} from './VisualizerBase';
import { SceneManager } from '../SceneManager';
import { AudioManager } from '../AudioManager';

import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';

import {
  Mesh,
  SphereGeometry,
  MeshStandardMaterial,
  Vector2,
  Vector3,
  Group,
} from 'three';

export class Lights extends VisualizerBase {
  numObjects: number;
  visualization: Group;
  lastTime: number;
  scaleTo: number[];
  composer: EffectComposer;
  bloomPass: UnrealBloomPass;
  
  constructor(name: string, sceneManager: SceneManager, audioManager: AudioManager, size: number){
    super(name, sceneManager, audioManager);
    this.numObjects = size;
    this.visualization = new Group();
    this.lastTime = this.clock.getElapsedTime();
    this.scaleTo = [];
    this.composer = new EffectComposer(this.renderer);
    
    this.configurableParams = {
      'bloomStrength': {value: 0.8, min: 0, max: 2.0, step: 0.1},
      'bloomRadius': {value: 1.0, min: 0, max: 2.0, step: 0.1},
      'bloomThreshold': {value: 0.1, min: 0, max: 2.0, step: 0.1},
      'speed': {value: 20, min: 1, max: 40, step: 1}, // TODO: this is actually inverted atm lol - smaller value == faster
    };
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
      const material = new MeshStandardMaterial({color: '#2ff109', transparent: true});
      const sphere = new Mesh(geometry, material);
      
      sphere.position.set(
        Math.random() * 40 + -15,
        Math.random() * 15 + -5,
        -15
      );
      
      const scale = Math.random() * (0.085 - 0.025) + 0.025;
      sphere.scale.set(scale, scale, scale); //0.08, 0.08, 0.08);
      
      // give the sphere a random velocity
      const randVelocity = new Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, 1);
      randVelocity.normalize();
      
      // @ts-ignore TS2339
      sphere.velocity = randVelocity;
      
      return sphere;
    };
    
    const skeletonGeometry = new SphereGeometry(15, 32, 16);
    
    // try Poisson disk sampling to distribute the spheres so none of them get placed too close to another?
    // http://devmag.org.za/2009/05/03/poisson-disk-sampling/
    // https://www.jasondavies.com/poisson-disc/
    for(let i = 0; i < bufferLen; i += increment){
      this.visualization.add(createVisualizationSphere());
    }
    
    this.scene.add(this.visualization);
    
    // glow effect stuff (Bloom effect)
    const container = this.renderer.domElement;
    
    if(container){
      const renderScene = new RenderPass(this.scene, this.camera);
      
      const effectFXAA = new ShaderPass(FXAAShader);
      effectFXAA.uniforms['resolution'].value.set(
        1 / container.clientWidth, 
        1 / container.clientHeight
      );

      const strength = this.configurableParams.bloomStrength as ConfigurableParameterRange;
      const radius = this.configurableParams.bloomRadius as ConfigurableParameterRange;
      const threshold = this.configurableParams.bloomThreshold as ConfigurableParameterRange;
      
      const bloomPass = new UnrealBloomPass(
        new Vector2(container.clientWidth, container.clientHeight),
        strength.value,
        radius.value,
        threshold.value,
      );
      
      this.bloomPass = bloomPass;

      this.composer.setSize(container.clientWidth, container.clientHeight);
      this.composer.addPass(renderScene);
      this.composer.addPass(effectFXAA);
      this.composer.addPass(bloomPass);
    }
    
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
      
      // @ts-ignore TS2339
      c.position.x += c.velocity.x / speed.value; //20;
      // @ts-ignore TS2339
      c.position.y += c.velocity.y / speed.value; //20;
      
      // if child goes out of viewport, adjust
      //
      // should we convert world pos to screen pos and check that?
      // https://stackoverflow.com/questions/11586527/converting-world-coordinates-to-screen-coordinates-in-three-js-using-projection
      // https://www.reddit.com/r/Unity3D/comments/e04hot/how_is_cameraworldtoviewportpoint_implemented/
      //
      // try this for now
      if(c.position.y > 30 || c.position.y < -30 || c.position.x < -30 || c.position.x > 30){
        // push the child back some multiple of its velocity vector
        c.position.set(
          // @ts-ignore TS2339
          c.position.x - c.velocity.x * 50,
          // @ts-ignore TS2339
          c.position.y - c.velocity.y * 50,
          c.position.z
        )
      }
    });
    
    if(this.bloomPass){
      const strength = this.configurableParams.bloomStrength as ConfigurableParameterRange;
      const radius = this.configurableParams.bloomRadius as ConfigurableParameterRange;
      const threshold = this.configurableParams.bloomThreshold as ConfigurableParameterRange;
      
      this.bloomPass.strength = strength.value;
      this.bloomPass.radius = radius.value;
      this.bloomPass.threshold = threshold.value;
    }
    
    this.composer.render(); // update bloom filter
  }
}