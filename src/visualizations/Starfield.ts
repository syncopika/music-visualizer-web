import {
  VisualizerBase,
  ConfigurableParameterToggle
} from './VisualizerBase';
import { SceneManager } from '../SceneManager';
import { AudioManager } from '../AudioManager';

import {
  Mesh,
  Vector3,
  Group,
  Quaternion,
  MeshStandardMaterial,
} from 'three';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

interface GLTFFile {
  asset: Record<string, string>,
  scene: Group,
}

export class Starfield extends VisualizerBase {
  numObjects: number;
  visualization: Group;
  loader: GLTFLoader;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  zMax: number;
  
  constructor(
    name: string,
    sceneManager: SceneManager,
    audioManager: AudioManager,
    size: number,
    xMin?: number,
    xMax?: number,
    yMin?: number,
    yMax?: number,
    zMax?: number,
  ){
    super(name, sceneManager, audioManager);
    this.numObjects = size;
    this.visualization = new Group();
    this.loader = new GLTFLoader();
    this.xMin = xMin || -50;
    this.xMax = xMax || 50;
    this.yMin = yMin || -50;
    this.yMax = yMax || 50;
    this.zMax = zMax || -100;
    (this.configurableParams.bloomPass as ConfigurableParameterToggle).isOn = true;
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
  
  // given a volume defined by width, height and length,
  // generate a set of positions of length numDesiredPos that should be
  // distributed such that they are all at least minDist apart
  //
  // https://sighack.com/post/poisson-disk-sampling-bridsons-algorithm
  // http://devmag.org.za/2009/05/03/poisson-disk-sampling/
  // https://stackoverflow.com/questions/56749446/generalizion-3d-possion-disk-sampling
  // also interesting: https://www.jasondavies.com/poisson-disc/
  // and https://www.redblobgames.com/x/1830-jittered-grid/
  generatePoissonDiskSamplingSet(
    width: number,
    height: number,
    length: number,
    minDist: number,
    numDesiredPos: number
  ): Array<Vector3> {
    // 3d grid
    // x dimension = width, y dimension = height, z dimension = length
    function createGrid(): Array<Array<Array<Vector3 | null>>>{
      const grid = [];
      for(let x = 0; x < width; x++){
        const xDim = [];
        for(let y = 0; y < height; y++){
          const yDim = [];
          for(let z = 0; z < length; z++){
            yDim.push(null);
          }
          xDim.push(yDim);
        }
        grid.push(xDim);
      }
      return grid;
    }
    
    function checkNeighbors(
      point: Vector3,
      minDist: number,
      cellSize: number,
      grid: Array<Array<Array<Vector3 | null>>>
    ): boolean{
      if(
        point.x < 0 ||
        point.x >= width ||
        point.y < 0 ||
        point.y >= height ||
        point.z < 0 ||
        point.z >= length
      ){
        return false;
      }
      
      // get the coordinates of point within the grid (i.e. which index in the grid does this point fall in)
      const xIdx = Math.floor(point.x / cellSize);
      const yIdx = Math.floor(point.y / cellSize);
      const zIdx = Math.floor(point.z / cellSize);
      
      // check point's neighbors
      for(let x = xIdx - 1; x <= xIdx + 1; x++){
        for(let y = yIdx - 1; y <= yIdx + 1; y++){
          for(let z = zIdx - 1; z <= zIdx + 1; z++){
            // check distance between this cell's point, if any, and point
            if(x < 0 || y < 0 || z < 0){
              continue;
            }
            
            if(xIdx != x && yIdx != y && zIdx != z && grid[x][y][z]){
              const neighbor = grid[x][y][z];
              if(neighbor && point.distanceTo(neighbor) < minDist){
                return false;
              }
            }
          }
        }
      }
      
      return true;
    }
    
    function addToGrid(point: Vector3, cellSize:number, grid: Array<Array<Array<Vector3 | null>>>){
      if(
        point.x < 0 ||
        point.x >= width ||
        point.y < 0 ||
        point.y >= height ||
        point.z < 0 ||
        point.z >= length
      ){
        // not sure this check is necessary but just in case
        console.log('warn: point out of range, can\'t add to grid');
        return;
      }

      // get the coordinates of point within the grid
      const xIdx = Math.floor(point.x / cellSize);
      const yIdx = Math.floor(point.y / cellSize);
      const zIdx = Math.floor(point.z / cellSize);
      grid[xIdx][yIdx][zIdx] = point;
    }
    
    const grid = createGrid();
    
    const cellSize = minDist / Math.sqrt(3); // 3 because we're in 3 dimensions
    const result: Array<Vector3> = [];
    let processing: Array<Vector3> = [new Vector3(0, 0, 0)];
    
    while(processing.length > 0){
      const curr = processing[Math.floor(Math.random() * processing.length)];
      
      let foundNewPos = false;
      const tries = 25;
      for(let i = 0; i < tries; i++){
        // get a random point within minDist and 2*minDist of curr
        // we can use Three.js for help with this via Vector3 :D
        // https://stackoverflow.com/questions/74228946/how-to-get-a-random-vector3-within-a-sphere
        const randomPoint = new Vector3();
        randomPoint.randomDirection();
        randomPoint.multiplyScalar(Math.random() * ((2 * minDist) - minDist) + minDist);
        randomPoint.add(curr);
        
        // check against neighbors of random point to see if this random point
        // is too close to an existing one.
        const isOk = checkNeighbors(randomPoint, minDist, cellSize, grid);
        
        if(isOk){
          processing.push(randomPoint);
          addToGrid(randomPoint, cellSize, grid);
          result.push(randomPoint);
          foundNewPos = true;
          break;
        }
      }
      
      if(!foundNewPos){
        // remove the point from processing
        processing = processing.filter(x => x !== curr);
      }
      
      // add random point to result and processing list
      if(result.length == numDesiredPos){
        return result;
      }
    }
    
    return result;
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
    
    // if a small analyser.fftSize is chosen, frequencyBinCount will be small as well and
    // so Math.floor(bufferLen / numObjects) may end up being 0
    const increment = Math.max(1, bufferLen / this.numObjects);
    
    /* TODO: need to experiment more with this and confirm it actually works per the algorithm
    // at least with smaller minDist values, the stars get more clustered as expected so that's good I think
    // maybe investigate more with adding a minDist wireframe sphere at each position to confirm
    const positions = this.generatePoissonDiskSamplingSet(
      Math.abs(this.xMax - this.xMin),
      Math.abs(this.yMax - this.yMin),
      Math.abs(this.zMax),
      25,
      this.numObjects + 1,
    );*/
    
    //let posIdx = 0; // when using poisson disk sampling 
    for(let i = 0; i < bufferLen; i += increment){
      const star = starModel.clone();
      
      /* when using poisson disk sampling 
      const xPos = positions[posIdx].x + this.xMin/3;
      const yPos = positions[posIdx].y + this.yMin/2;
      const zPos = positions[posIdx].z + this.zMax/3;
      */
      
      const xPos = Math.floor(Math.random() * (this.xMax - this.xMin) + this.xMin);
      const yPos = Math.floor(Math.random() * (this.yMax - this.yMin) + this.yMin);
      const zPos = Math.floor(Math.random() * (this.zMax));

      star.position.set(xPos, yPos, zPos);
      
      // give star a random rotation
      star.quaternion.copy(this.generateRandomQuaternion());

      this.visualization.add(star);
      
      //posIdx++;
    }
    
    this.scene.add(this.visualization);
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
    
    this.doPostProcessing();
  }
}