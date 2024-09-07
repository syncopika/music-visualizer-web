import { 
  Scene, 
  Color, 
  SpotLight, 
  Camera,
  PerspectiveCamera,
  WebGLRenderer,
  Mesh,
  PCFSoftShadowMap,
} from 'three';

import { AudioManager } from './AudioManager';

// visualizers
import { VisualizerBase } from './visualizations/VisualizerBase';
import { Waveform } from './visualizations/Waveform';
import { Starfield } from './visualizations/Starfield';
import { Pixels } from './visualizations/Pixels';

// important scene-related objects we might need to pass around
interface ISceneComponents {
  renderer: WebGLRenderer, 
  scene: Scene, 
  camera: Camera
}

// global variables
let isPlaying = false;
let visualizer: VisualizerBase | null = null;

let recordingOn = false;
let mediaRecorder: MediaRecorder | null = null;
let capturedVideoChunks: Blob[] = [];

// stuff for canvas recording - try webm first for now
// helpful! https://devtails.xyz/@adam/how-to-record-html-canvas-using-mediarecorder-and-export-as-video
// https://stackoverflow.com/questions/77130824/is-it-possible-to-bind-a-html-canvas-to-an-ffmpeg-javascript-port-to-get-a-video
// https://stackoverflow.com/questions/62863547/save-canvas-data-as-mp4-javascript
// https://stackoverflow.com/questions/76706744/whats-the-most-performant-way-to-encode-an-mp4-video-of-frames-from-a-webgl-can
// https://stackoverflow.com/questions/60882162/im-not-able-to-view-the-total-length-of-the-recorded-video-and-the-timelines
function startCanvasRecord(renderer: WebGLRenderer){
  if(!mediaRecorder){
    const canvasStream = renderer.domElement.captureStream();
    mediaRecorder = new MediaRecorder(canvasStream, {mimeType: 'video/webm'});
    
    mediaRecorder.ondataavailable = (e) => {
      capturedVideoChunks.push(e.data);
    };
    
    mediaRecorder.onstop = () => {
      const blob = new Blob(capturedVideoChunks);
      const recordedVideoUrl = URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      downloadLink.download = `${new Date()}_recording.webm`;
      downloadLink.href = recordedVideoUrl;
      downloadLink.target = '_blank';
      downloadLink.click();
    };
  }
  
  mediaRecorder.start();
}

function stopCanvasRecord(){
  if(mediaRecorder){
    mediaRecorder.stop();
    capturedVideoChunks = [];
  }
  
  // at least for now, we can merge the resulting webm with wav audio via ffmpeg, for example.
  // e.g. ffmpeg -i "video.webm" -i "music.wav" -c:v copy "output.webm"
}

function initializeScene(container: HTMLCanvasElement): ISceneComponents {
  const scene = new Scene();
  scene.background = new Color(0x111e37); //new Color(0xeeeeee);
  
  const renderer = new WebGLRenderer({antialias: true});
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  
  const fov = 60;
  const camera = new PerspectiveCamera(
    fov, 
    container.clientWidth / container.clientHeight, 
    0.01, 
    1000
  );
    
  camera.position.set(0, 2, 8);
  scene.add(camera);
  
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
  
  renderer.render(scene, camera);
  
  return {renderer, scene, camera};
}

function update(){
  renderer.render(scene, camera);
  requestAnimationFrame(update);
  if(visualizer && isPlaying){
    visualizer.update();
  }
}

function playVisualization(){
  audioManager.play();
  isPlaying = true;
  
  if(recordingOn){
    console.log('starting record');
    startCanvasRecord(renderer);
  }
}

function stopVisualization(){
  audioManager.stop();
  isPlaying = false;
  
  if(recordingOn){
    console.log('stopping record');
    stopCanvasRecord();
  }
}

function switchVisualizer(evt: Event){
  const selected = (evt.target as HTMLSelectElement).value;
  
  // reset camera in case it was rotated or moved
  camera.position.set(0, 2, 8);
  camera.rotation.set(0, 0, 0);
  
  switch (selected) {
    case 'waveform':
      visualizer = new Waveform('waveform', scene, audioManager, 50);
      visualizer.init();
      break;
    case 'starfield':
      visualizer = new Starfield(
        'starfield',
        scene,
        camera,
        renderer,
        audioManager,
        80
      );
      visualizer.init();
      break;
    case 'pixels':
      visualizer = new Pixels('pixels', scene, audioManager);
      visualizer.init();      
    default:
      break;
  }
}

// start
const audioManager = new AudioManager();
const importAudioBtn = document.getElementById("importAudio");
if(importAudioBtn) audioManager.setupInput((importAudioBtn as HTMLButtonElement));
audioManager.loadExample();

// setup some event listeners
document.getElementById('playVisualization')?.addEventListener('click', playVisualization);
document.getElementById('stopVisualization')?.addEventListener('click', stopVisualization);
document.getElementById('visualizerChoice')?.addEventListener('change', switchVisualizer);
document.getElementById('toggleRecordingCheckbox')?.addEventListener(
  'change', () => recordingOn = !recordingOn
);

const canvasContainer = document.getElementById('canvasContainer');
const { renderer, scene, camera } = initializeScene((canvasContainer as HTMLCanvasElement));

// stuff has loaded, hide loading message
const loadingMsg = document.getElementById('loadingMsg');
if(loadingMsg) loadingMsg.style.display = 'none';

visualizer = new Waveform('waveform', scene, audioManager, 50);
visualizer.init();

update();
