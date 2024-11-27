import { 
  Scene,
  Camera,
  Clock,
  WebGLRenderer,
  Vector2,
} from 'three';

import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { SceneManager } from '../SceneManager';
import { AudioManager } from '../AudioManager';

export interface ConfigurableParameterRange {
  value: number;
  min: number;
  max: number;
  step: number;
  doNotShow?: boolean; // in case we still need to figure stuff out but would like to make it user-configurable in the future :)
}

export interface ConfigurableParameterToggle {
  isOn: boolean;
  doNotShow?: boolean;
}

export class VisualizerBase {
  name: string;
  sceneManager: SceneManager;
  audioManager: AudioManager;
  clock: Clock;
  scene: Scene;
  camera: Camera;
  renderer: WebGLRenderer;
  composer: EffectComposer;
  bloomPass: UnrealBloomPass;
  afterimagePass: AfterimagePass;
  outputPass: OutputPass;
  configurableParams: Record<string, ConfigurableParameterRange | ConfigurableParameterToggle>;
  
  constructor(name: string, sceneManager: SceneManager, audioManager: AudioManager){
    this.name = name;
    this.sceneManager = sceneManager;
    this.audioManager = audioManager;
    this.scene = sceneManager.scene;
    this.clock = sceneManager.clock;
    this.camera = sceneManager.camera;
    this.renderer = sceneManager.renderer;
    this.configurableParams = {
      'bloomPass': {isOn: false},
      'bloomStrength': {value: 0.8, min: 0, max: 2.0, step: 0.1},
      'bloomRadius': {value: 1.0, min: 0, max: 2.0, step: 0.1},
      'bloomThreshold': {value: 0.1, min: 0, max: 2.0, step: 0.1},
      'afterimagePass': {isOn: false},
      'afterimageDamp': {value: 0.5, min: 0, max: 1, step: 0.1},
    };
    
    // post-processing effects
    this.composer = new EffectComposer(this.renderer);
    const container = this.renderer.domElement;
    if(container){
      const renderScene = new RenderPass(this.scene, this.camera);
      
      // important: order of addition of effects matters!
      const effectFXAA = new ShaderPass(FXAAShader);
      effectFXAA.uniforms['resolution'].value.set(
        1 / container.clientWidth, 
        1 / container.clientHeight
      );
      
      this.composer.setSize(container.clientWidth, container.clientHeight);
      this.composer.addPass(renderScene);
      this.composer.addPass(effectFXAA);
      
      const afterimageDamp = this.configurableParams.afterimageDamp as ConfigurableParameterRange; 
      this.afterimagePass = new AfterimagePass();
      this.afterimagePass.uniforms.damp = {value: afterimageDamp.value};
      this.afterimagePass.enabled = false;
      this.composer.addPass(this.afterimagePass);
      
      this.outputPass = new OutputPass();
      this.outputPass.enabled = false;
      this.composer.addPass(this.outputPass);

      const strength = this.configurableParams.bloomStrength as ConfigurableParameterRange;
      const radius = this.configurableParams.bloomRadius as ConfigurableParameterRange;
      const threshold = this.configurableParams.bloomThreshold as ConfigurableParameterRange;
      
      this.bloomPass = new UnrealBloomPass(
        new Vector2(container.clientWidth, container.clientHeight),
        strength.value,
        radius.value,
        threshold.value,
      );
      this.bloomPass.enabled = false;
      
      this.composer.addPass(this.bloomPass);
    }
  }
  
  doPostProcessing(){
    const afterimagePass = this.configurableParams.afterimagePass as ConfigurableParameterToggle;
    const bloomPass = this.configurableParams.bloomPass as ConfigurableParameterToggle;
    
    // bloom pass params
    const strength = this.configurableParams.bloomStrength as ConfigurableParameterRange;
    const radius = this.configurableParams.bloomRadius as ConfigurableParameterRange;
    const threshold = this.configurableParams.bloomThreshold as ConfigurableParameterRange;
    
    if(afterimagePass.isOn){
      // afterimage pass params
      const afterimageDamp = this.configurableParams.afterimageDamp as ConfigurableParameterRange;
      this.afterimagePass.uniforms.damp = {value: afterimageDamp.value};
    
      this.afterimagePass.enabled = true;
      this.outputPass.enabled = true;
    }else{
      this.afterimagePass.enabled = false;
      this.outputPass.enabled = false;
    }
    
    if(bloomPass.isOn){
      this.bloomPass.enabled = true;
      this.bloomPass.strength = strength.value;
      this.bloomPass.radius = radius.value;
      this.bloomPass.threshold = threshold.value;  
    }else{
      this.bloomPass.enabled = false;
    }
    
    if(afterimagePass.isOn || bloomPass.isOn){
      this.composer.render();
    }
  }

  init(){
    // initialize the scene
  }
  
  update(){
    // run the visualizer.
  }

  info(){
    // TODO: get some info about the scene
    console.log(`some info about the ${this.name} visualizer.`);
  }
}