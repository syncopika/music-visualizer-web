import { VisualizerBase } from './VisualizerBase';

import { AudioManager } from '../AudioManager';

import { 
  Scene,
  Camera,
  Mesh,
  Vector3,
  Group,
  Quaternion,
  Vector2,
  WebGLRenderer,
  MeshStandardMaterial,
} from 'three';

import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

interface GLTFFile {
  asset: Record<string, string>,
  scene: Group,
  // animations: [],
  // parser: GLTFParser,
  // scenes: Group[],
  // userData: Record<string, string>
}

export class Starfield extends VisualizerBase {
  numObjects: number;
  visualization: Group;
  loader: GLTFLoader;
  camera: Camera;
  renderer: WebGLRenderer
  composer: EffectComposer;
  //starModel: Mesh;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  zMax: number;
  
  constructor(
    name: string,
    scene: Scene,
    camera: Camera,
    renderer: WebGLRenderer,
    audioManager: AudioManager,
    size: number,
    xMin?: number,
    xMax?: number,
    yMin?: number,
    yMax?: number,
    zMax?: number,
  ){
    super(name, scene, audioManager);
    this.numObjects = size;
    this.visualization = new Group();
    this.loader = new GLTFLoader();
    this.camera = camera;
    this.renderer = renderer;
    this.composer = new EffectComposer(this.renderer);
    this.xMin = xMin || -50;
    this.xMax = xMax || 50;
    this.yMin = yMin || -20;
    this.yMax = yMax || 50;
    this.zMax = zMax || -100;
  }
  
  loadModel(url: string){
    // https://discourse.threejs.org/t/most-simple-way-to-wait-loading-in-gltf-loader/13896/4
    return new Promise((resolve, reject) => {
      this.loader.load(url, data => resolve(data), undefined, reject);
    });
  }
  
  generateRandomQuaternion(): Quaternion {
    // https://stackoverflow.com/questions/31600717/how-to-generate-a-random-quaternion-quickly
    const u = Math.random();
    const v = Math.random();
    const w = Math.random();
    
    const x = Math.sqrt(1 - u) * Math.sin(2 * Math.PI * v);
    const y = Math.sqrt(1 - u) * Math.cos(2 * Math.PI * v);
    const z = Math.sqrt(u) * Math.sin(2 * Math.PI * w);
    const w2 = Math.sqrt(u) * Math.cos(2 * Math.PI * w);
    
    return new Quaternion(x, y, z, w2);
  }
  
  async init(){
    // clear the scene
    this.scene.children.forEach(c => {
      if(
        !c.type.toLowerCase().includes('camera') && 
        !c.type.toLowerCase().includes('light'))
      {  
        this.scene.remove(c);
      }
    });
    
    // load gltf model of star
    const starGltf = await this.loadModel('/assets/star.gltf');
    const starModel: Mesh = (starGltf as GLTFFile).scene.children[0] as Mesh;
    starModel.scale.set(0.5, 0.5, 0.5);
    
    const starMaterial = starModel.material as MeshStandardMaterial;
    starMaterial.emissive = starMaterial.color;
    starMaterial.emissiveIntensity = 0.8;
    
    const bufferLen = this.audioManager.analyser.frequencyBinCount;

    const numObjects = this.numObjects;
    const increment = Math.floor(bufferLen / numObjects);
    
    for(let i = 0; i < bufferLen; i += increment){
      const star = starModel.clone();
      
      const xPos = Math.floor(Math.random() * (this.xMax - this.xMin) + this.xMin);
      const yPos = Math.floor(Math.random() * (this.yMax - this.yMin) + this.yMin);
      const zPos = Math.floor(Math.random() * (this.zMax));

      star.position.set(xPos, yPos, zPos);
      
      // give star a random rotation
      star.quaternion.copy(this.generateRandomQuaternion());

      this.visualization.add(star);
    }
    
    // glow effect stuff (Bloom effect)
    const container = this.renderer.domElement;
    
    if(container){
      const renderScene = new RenderPass(this.scene, this.camera);
      
      const effectFXAA = new ShaderPass(FXAAShader);
      effectFXAA.uniforms['resolution'].value.set(
        1 / container.clientWidth, 
        1 / container.clientHeight
      );

      const bloomPass = new UnrealBloomPass(
        new Vector2(container.clientWidth, container.clientHeight),
        0.7, //0.25, // bloom strength
        0.9, //0.1, // bloom radius
        0.1,        // bloom threshold
      );

      this.composer.setSize(container.clientWidth, container.clientHeight);
      this.composer.addPass(renderScene);
      this.composer.addPass(effectFXAA);
      this.composer.addPass(bloomPass);
      
      this.scene.add(this.visualization);
    }
  }
  
  update(){
    const bufferLength = this.audioManager.analyser.frequencyBinCount;
    const buffer = this.audioManager.buffer;
    const numObjects = this.visualization.children.length;
    const increment = Math.floor(bufferLength / numObjects);
    
    this.audioManager.analyser.getByteTimeDomainData(buffer);
    
    for(let i = 0; i < numObjects; i++){
      const obj = this.visualization.children[i];
      const value = buffer[i * increment] / 255; //128.0; // why 128?
      // value = obj.initialPosition - (value * 6);
      //obj.position.lerp(new Vector3(obj.position.x, y, obj.position.z), 0.2); // lerp for smoother animation
      obj.scale.lerp(new Vector3(value, value, value), 0.2);
      
      // also rotate each star about their own local y-axis
      obj.rotateY(Math.PI / 1000);
      
      // check to see if star is behind camera. if so, move it back in front
      if(this.camera.position.z - obj.position.z < 0){
        obj.position.set(
          obj.position.x, 
          obj.position.y, 
          this.camera.position.z + Math.floor(Math.random() * (this.zMax))
        );
      }
    }
    
    this.camera.translateZ(-0.01); // move camera forward a bit
    this.camera.rotateZ(-Math.PI / 2500); // rotate the camera 
    this.composer.render(); // update bloom filter
  }
}