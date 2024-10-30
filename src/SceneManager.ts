import { 
  Scene, 
  Color, 
  SpotLight, 
  Camera,
  PerspectiveCamera,
  WebGLRenderer,
  PCFSoftShadowMap,
  //Clock,
} from 'three';

// TODO: add clock
export class SceneManager {
  scene: Scene;
  renderer: WebGLRenderer;
  camera: Camera;
  light: SpotLight;
  
  constructor(container: HTMLCanvasElement){
    const scene = new Scene();
    scene.background = new Color(0x111e37); //new Color(0xeeeeee);
    this.scene = scene;
    
    const renderer = new WebGLRenderer({antialias: true});
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    this.renderer = renderer;
    
    const fov = 60;
    const camera = new PerspectiveCamera(
      fov, 
      container.clientWidth / container.clientHeight, 
      0.01, 
      1000
    );
      
    camera.position.set(0, 2, 8);
    scene.add(camera);
    this.camera = camera;    
    
    // https://discourse.threejs.org/t/upgraded-to-latest-r160-and-my-lighting-has-changed/59879
    const light = new SpotLight(); //0x34fcc5);
    light.position.set(0, 20, 0);
    light.castShadow = true;
    light.shadow.mapSize.width = 1024;
    light.shadow.mapSize.height = 1024;
    light.intensity = 5;
    light.distance = 0;
    light.decay = 0; //0.1;
    scene.add(light);
    this.light = light;
    
    renderer.render(scene, camera);    
  }
  
  // be able to update lighting here
  updateSceneLighting(axis: string, val: number){
    if(this.light){
      if(axis === 'lightX'){
        this.light.position.x = val;
      }else if(axis === 'lightY'){
        this.light.position.y = val;
      }else if(axis === 'lightZ'){
        this.light.position.z = val;
      }
    }
  }
  
  // be able to update scene background color here
  updateSceneBackgroundColor(color: string){
    if(this.scene) this.scene.background = new Color(color);
  }
}