import { 
  Scene, 
  Color, 
  SpotLight, 
  Camera,
  PerspectiveCamera,
  WebGLRenderer,
  PCFSoftShadowMap,
  Clock,
  Mesh,
  MeshStandardMaterial,
  Texture,
  SRGBColorSpace,
} from 'three';

export class SceneManager {
  scene: Scene;
  renderer: WebGLRenderer;
  camera: Camera;
  light: SpotLight;
  clock: Clock;
  texture: Texture | null;
  
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
    
    this.clock = new Clock();
    
    this.texture = null;
    
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
  
  toggleWireframe(){
    this.scene.children.forEach(child => {
      if(child.type === 'Group'){
        (child.children as Mesh[]).forEach(c => {
          const meshMaterial = c.material as MeshStandardMaterial;
          if(meshMaterial){
            meshMaterial.wireframe = !meshMaterial.wireframe;
          }else if(c.children){
            // TODO: recursively apply/unapply wireframe if Group is found
            (c.children as Mesh[]).forEach(c2 => {
              const meshMaterial = c2.material as MeshStandardMaterial;
              meshMaterial.wireframe = !meshMaterial.wireframe;
            });
          }
        });
      }
    });
  }
  
  changeVisualizationColor(color: string){
    this.scene.children.forEach(child => {
      if(child.type === 'Group'){
        (child.children as Mesh[]).forEach(c => {
          if(c.material){
            (c.material as MeshStandardMaterial).color = new Color(color);
          }else if(c.children){
            // TODO: recursively apply new color to children if Group is found
            (c.children as Mesh[]).forEach(c2 => {
              (c2.material as MeshStandardMaterial).color = new Color(color);
            });
          }
        });
      }
    });
  }
  
  updateTexture(texture: Texture | null){
    if(texture !== null){
      // important so the texture doesn't look lighter than the original images
      // https://discourse.threejs.org/t/videotexture-is-bright-and-washed-out/60287
      texture.colorSpace = SRGBColorSpace;
      
      this.scene.children.forEach(child => {
        if(child.type === 'Group'){
          (child.children as Mesh[]).forEach(c => {
            if(c.material){
              (c.material as MeshStandardMaterial).map = texture;
              (c.material as MeshStandardMaterial).needsUpdate = true;
            }else if(c.children){
              // TODO: recursively apply new color to children if Group is found
              (c.children as Mesh[]).forEach(c2 => {
                (c2.material as MeshStandardMaterial).map = texture;
                (c.material as MeshStandardMaterial).needsUpdate = true;
              });
            }
          });
        }
      });
    }else if(texture === null){
      this.scene.children.forEach(child => {
        if(child.type === 'Group'){
          (child.children as Mesh[]).forEach(c => {
            if(c.material){
              (c.material as MeshStandardMaterial).map = null;
              (c.material as MeshStandardMaterial).needsUpdate = true;
            }else if(c.children){
              // TODO: recursively apply new color to children if Group is found
              (c.children as Mesh[]).forEach(c2 => {
                (c2.material as MeshStandardMaterial).map = null;
                (c.material as MeshStandardMaterial).needsUpdate = true;
              });
            }
          });
        }
      });      
    }
  }
}