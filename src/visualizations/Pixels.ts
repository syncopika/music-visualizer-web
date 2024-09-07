import { VisualizerBase } from './VisualizerBase';

import { AudioManager } from '../AudioManager';

import {
  Mesh,
  RGBAFormat,
  ShaderMaterial,
  DataTexture,
  PlaneGeometry,
  Scene,
} from 'three';

export class Pixels extends VisualizerBase {  
  vertexShader: string;
  fragmentShader: string;
  uniforms;
  
  constructor(name: string, scene: Scene, audioManager: AudioManager){
    super(name, scene, audioManager);
    
    // borrowed from:
    // https://github.com/mrdoob/three.js/blob/master/examples/webaudio_visualizer.html
    this.vertexShader = `
    	varying vec2 vUv;

			void main() {
				vUv = uv;

				gl_Position = vec4( position, 1.0 );
			}
    `;
    
    this.fragmentShader = `
			uniform sampler2D tAudioData;
			varying vec2 vUv;

			void main() {
				vec3 backgroundColor = vec3( 0.125, 0.125, 0.125 );
				vec3 color = vec3( 1.0, 1.0, 0.0 );

				float f = texture2D( tAudioData, vec2( vUv.x, 0.0 ) ).r;

				float i = step( vUv.y, f ) * step( f - 0.0125, vUv.y );

				gl_FragColor = vec4( mix( backgroundColor, color, i ), 1.0 );
			}
    `;
    
    this.uniforms = {
      tAudioData: {
        value: new DataTexture(
          this.audioManager.buffer,
          128 / 2,  // 128 == fft size
          1,
          RGBAFormat,
        )
      }
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
    
    // TODO: reset camera
    const material = new ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: this.vertexShader,
      fragmentShader: this.fragmentShader,
    });
    
    const geometry = new PlaneGeometry(2, 2);
    const mesh = new Mesh(geometry, material);
    
    this.scene.add(mesh);
  }
  
  update(){
    const buffer = this.audioManager.buffer;
    this.audioManager.analyser.getByteFrequencyData(buffer);
    this.uniforms.tAudioData.value.needsUpdate = true;
  }
}