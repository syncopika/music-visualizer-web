import {
  VisualizerBase,
  ConfigurableParameterRange,
  ConfigurableParameterToggle,
} from './VisualizerBase';
import { SceneManager } from '../SceneManager';
import { AudioManager } from '../AudioManager';

// allow user to import image to show on plane
// https://github.com/syncopika/room-designer/blob/main/src/index.js#L742
// https://github.com/syncopika/room-designer/blob/main/src/index.js#L407

// TODO:
// add option to:
// take into account audio data (time domain? frequency?)
// based on audio data avg (use avg?), adjust texture colors accordingly
// e.g. stronger beats = brighter colors?

import {
  Mesh,
  Group,
  PlaneGeometry,
  MeshBasicMaterial,
  ShaderMaterial,
  DoubleSide,
} from 'three';

export class ImagePlane extends VisualizerBase {
  visualization: Group;
  
  constructor(name: string, sceneManager: SceneManager, audioManager: AudioManager){
    super(name, sceneManager, audioManager);
    this.visualization = new Group();
    
    const params: Record<string, ConfigurableParameterRange> = {
      'xPos': {value: 0, min: -15, max: 15, step: 0.5},
      'yPos': {value: 1.5, min: -15, max: 15, step: 0.5},
      'zPos': {value: -25, min: -50, max: 10, step: 0.5},
      'xScale': {value: 1, min: 0.2, max: 3, step: 0.1},
      'yScale': {value: 1, min: 0.2, max: 3, step: 0.1},
      'useShaderMaterial': {isOn: false, parameterName: 'use shader material?'}, // shader material toggle
    };
    
    Object.keys(params).forEach(p => this.configurableParams[p] = params[p]);
    
    this.texture = null;
    
    this.vertexShader = `
    	varying vec2 vUv;

			void main(){
				vUv = uv;

        // https://stackoverflow.com/questions/52391039/three-js-shadermaterial-exceeds-of-my-mesh
        gl_Position = projectionMatrix *
                      modelViewMatrix *
                      vec4(position, 1.0);
			}
    `;
    
    this.fragmentShader = `
      uniform sampler2D img;
			uniform float uAudioDataAvg;
			varying vec2 vUv;

      // TODO: inverse proportion? larger audio data value -> color gets "brighter" -> closer to 255?
			void main(){
				vec4 color = texture2D(img, vUv);
        gl_FragColor = mix(vec4(1., 1., 1., 1.), color, uAudioDataAvg / 50.);
			}
    `;
    
    this.uniforms = {
      uAudioDataAvg: {value: 0.0}
    };
    
    if(sceneManager.texture){
      this.texture = sceneManager.texture;
      // add texture to uniforms
      this.uniforms.img = {type: 't', value: this.texture};
    }
    
    this.shaderMaterial = new ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: this.vertexShader,
      fragmentShader: this.fragmentShader,
    });
    
    this.meshBasicMaterial = new MeshBasicMaterial({color: 0xffffff, side: DoubleSide});
    
    const planeGeometry = new PlaneGeometry(30, 30, 1, 1);
    this.plane = new Mesh(planeGeometry, this.meshBasicMaterial);
  }
  
  getAudioDataAvg(buf){
    // we're assuming time domain data
    // TODO: should we only care about the positive values?
    let total = 0;
    for(let i = 0; i < buf.length; i++){
      total += buf[i];
    }
    return total / buf.length;
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
    
    // create plane mesh to hold image
    this.visualization.add(this.plane);
    
    this.scene.add(this.visualization);
    this.visualization.position.z = -25;
    this.visualization.position.y += 1.5;
  }
  
  updateShaderMaterial(){
    if(this.sceneManager.texture != this.texture){
      this.texture = this.sceneManager.texture;
      this.uniforms.img = {type: 't', value: this.texture};
      
      this.shaderMaterial = new ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: this.vertexShader,
        fragmentShader: this.fragmentShader,
      });
    }
  }
  
  update(){
    this.updateShaderMaterial();
    
    // check if we need to switch materials
    if(this.configurableParams.useShaderMaterial.isOn){
      if(this.plane.material != this.shaderMaterial){
        console.log('using shader material');
        this.plane.material = this.shaderMaterial;
      }
      
      const buffer = this.audioManager.buffer;
      this.audioManager.analyser.getByteFrequencyData(buffer);
      
      const audioDataAvg = this.getAudioDataAvg(buffer);
      this.uniforms.uAudioDataAvg.value = audioDataAvg;
      //console.log(audioDataAvg);
    }else{
      if(this.plane.material != this.meshBasicMaterial){
        console.log('using basic mesh material');
        this.plane.material = this.meshBasicMaterial;
      }
    }
    
    this.doPostProcessing();
    //this.visualization.rotateY(Math.PI / 300);
    
    const params = this.configurableParams;
    this.visualization.position.x = (params.xPos as ConfigurableParameterRange).value;
    this.visualization.position.y = (params.yPos as ConfigurableParameterRange).value;
    this.visualization.position.z = (params.zPos as ConfigurableParameterRange).value;
    
    const xScale = (params.xScale as ConfigurableParameterRange).value;
    const yScale = (params.yScale as ConfigurableParameterRange).value;
    this.visualization.scale.set(xScale, yScale, 1);
  }
}
