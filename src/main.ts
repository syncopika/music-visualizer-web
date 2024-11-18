import { 
  WebGLRenderer,
} from 'three';

import { SceneManager } from './SceneManager';
import { AudioManager } from './AudioManager';

// visualizers
import { 
  VisualizerBase, 
  ConfigurableParameterRange,
  ConfigurableParameterToggle,
} from './visualizations/VisualizerBase';
import { Waveform } from './visualizations/Waveform';
import { Starfield } from './visualizations/Starfield';
import { Pixels } from './visualizations/Pixels';
import { CircularCubes } from './visualizations/CircularCubes';
import { Blob as AnimatedBlob } from './visualizations/Blob';
import { Spheres } from './visualizations/Spheres';
import { Waves } from './visualizations/Waves';

// global variables
let isPlaying = false;
let visualizer: VisualizerBase | null = null;

let recordingOn = false;
let mediaRecorder: MediaRecorder | null = null;
let capturedVideoChunks: Blob[] = [];

const audioManager = new AudioManager();

// html elements
const importAudioBtn = document.getElementById('importAudio');
const canvasContainer = document.getElementById('canvasContainer');
const playBtn = document.getElementById('playVisualization');
const stopBtn = document.getElementById('stopVisualization');
const vizSelect = document.getElementById('visualizerChoice');
const toggleRecording = document.getElementById('toggleRecordingCheckbox');
const loadingMsg = document.getElementById('loadingMsg');
const drawer = document.querySelector('.drawer');
//const visualizerOptions = document.getElementById('visualizerSpecificOptions');
const showDrawer = document.getElementById('showDrawer');
const hideDrawer = document.getElementById('hideDrawer');
const bgColorPicker = document.getElementById('bgColorPicker');
const vizColorPicker = document.getElementById('vizColorPicker');
const fftSizeDropdown = document.getElementById('fftSizeSelect');
const toggleWireframeCheckbox = document.getElementById('toggleWireframeInput');

// stuff for canvas recording
// helpful! https://devtails.xyz/@adam/how-to-record-html-canvas-using-mediarecorder-and-export-as-video
// https://stackoverflow.com/questions/77130824/is-it-possible-to-bind-a-html-canvas-to-an-ffmpeg-javascript-port-to-get-a-video
// https://stackoverflow.com/questions/62863547/save-canvas-data-as-mp4-javascript
// https://stackoverflow.com/questions/76706744/whats-the-most-performant-way-to-encode-an-mp4-video-of-frames-from-a-webgl-can
// https://stackoverflow.com/questions/60882162/im-not-able-to-view-the-total-length-of-the-recorded-video-and-the-timelines
// https://stackoverflow.com/questions/39302814/mediastream-capture-canvas-and-audio-simultaneously
function startCanvasRecord(renderer: WebGLRenderer){
  if(!mediaRecorder){
    if(canvasContainer) canvasContainer.style.border = '3px solid #aaff00';
    
    const canvasStream = renderer.domElement.captureStream();
    
    const audioTrack = audioManager.mediaStreamDestination.stream.getAudioTracks()[0];
    canvasStream.addTrack(audioTrack); // make sure we record the audio too
    
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
      
      capturedVideoChunks = [];
    };
    
    mediaRecorder.start();
  }
}

function stopCanvasRecord(){
  if(mediaRecorder){
    if(canvasContainer) canvasContainer.style.border = 'none';
    
    mediaRecorder.stop();
    mediaRecorder = null;
  }
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

function makeBoolToggle(name: string, parameter: ConfigurableParameterToggle): HTMLElement {
  const div = document.createElement('div');
  div.className = 'input';
  div.style.display = 'flex';
  div.style.alignItems = 'center';
  
  const label = document.createElement('label');
  label.textContent = name;
  label.htmlFor = `${name}-toggle`;
  
  const input = document.createElement('input');
  input.id = `${name}-toggle`;
  input.type = 'checkbox';
  input.checked = parameter.isOn;
  input.addEventListener('change', () => {
    parameter.isOn = !parameter.isOn;
  });
  
  div.appendChild(label);
  div.appendChild(input);
  
  return div;
}

function makeSlider(name: string, parameter: ConfigurableParameterRange): HTMLElement {
  const div = document.createElement('div');
  div.className = 'input';
  div.style.display = 'flex';
  div.style.alignItems = 'center';

  const label = document.createElement('label');
  label.textContent = name;
  label.htmlFor = `${name}-slider`;
  
  const currVal = document.createElement('p');
  currVal.textContent = parameter.value.toString();
  
  const input = document.createElement('input');
  input.id = `${name}-slider`;
  input.type = 'range';
  input.value = parameter.value.toString();
  input.min = parameter.min.toString();
  input.max = parameter.max.toString();
  input.step = parameter.step.toString();
  input.addEventListener('change', (evt: Event) => {
    const target = evt.target as HTMLInputElement;
    parameter.value = parseFloat(target.value);
    currVal.textContent = target.value.toString();
  });
  
  div.appendChild(label);
  div.appendChild(input);
  div.appendChild(currVal);
  
  return div;
}

function displayVisualizerConfigurableParams(visualizer: VisualizerBase){
  // clear visualizer-specific parameter section
  const paramSection = document.getElementById('visualizerSpecificOptions');
  paramSection?.replaceChildren();
  
  // add current visualizer-specific parameters
  const params = Array.from(Object.keys(visualizer.configurableParams));
  params.forEach(p => {
    const param = visualizer.configurableParams[p];
    if(param?.doNotShow){
      return;
    }
    
    if('isOn' in param){
      // simple on/off toggle
      const newToggleDiv = makeBoolToggle(p, param);
      paramSection?.appendChild(newToggleDiv);
    }else{
      // slider
      const newSliderDiv = makeSlider(p, (param as ConfigurableParameterRange));
      paramSection?.appendChild(newSliderDiv);
    }
  });
}

function switchVisualizer(evt: Event){
  const selected = (evt.target as HTMLSelectElement).value;
  
  // reset camera in case it was rotated or moved
  camera.position.set(0, 2, 8);
  camera.rotation.set(0, 0, 0);
  
  switch(selected){
    case 'waveform':
      visualizer = new Waveform('waveform', sceneManager, audioManager, 50);
      visualizer.init();
      break;
    case 'circular-cubes':
      visualizer = new CircularCubes('circular-cubes', sceneManager, audioManager, 50);
      visualizer.init();
      break;
    case 'starfield':
      visualizer = new Starfield('starfield', sceneManager, audioManager, 80);
      visualizer.init();
      break;
    case 'pixels':
      visualizer = new Pixels('pixels', sceneManager, audioManager);
      visualizer.init();    
      break;
    case 'blob':
      visualizer = new AnimatedBlob('blob', sceneManager, audioManager);
      visualizer.init();
      break;
    case 'spheres':
      visualizer = new Spheres('spheres', sceneManager, audioManager, 50);
      visualizer.init();
      break;
    case 'waves':
      visualizer = new Waves('waves', sceneManager, audioManager, 50);
      visualizer.init();
      break;
    default:
      break;
  }
  
  if(toggleWireframeCheckbox) (toggleWireframeCheckbox as HTMLInputElement).checked = false;
  
  if(visualizer) displayVisualizerConfigurableParams(visualizer);
}

// start
if(importAudioBtn) audioManager.setupInput((importAudioBtn as HTMLButtonElement));
audioManager.loadExample();

// setup some event listeners for buttons and inputs
playBtn?.addEventListener('click', playVisualization);
stopBtn?.addEventListener('click', stopVisualization);
vizSelect?.addEventListener('change', switchVisualizer);

toggleRecording?.addEventListener(
  'change', () => recordingOn = !recordingOn
);

showDrawer?.addEventListener('click', () => {
  if(drawer) (drawer as HTMLElement).style.display = 'block';
});

hideDrawer?.addEventListener('click', () => {
  if(drawer) (drawer as HTMLElement).style.display = 'none'; 
});

bgColorPicker?.addEventListener('change', (evt: Event) => {
  const target = evt.target as HTMLInputElement;
  if(sceneManager && target) sceneManager.updateSceneBackgroundColor(target.value);
});

vizColorPicker?.addEventListener('change', (evt: Event) => {
  const target = evt.target as HTMLInputElement;
  if(sceneManager && target) sceneManager.changeVisualizationColor(target.value);
});

fftSizeDropdown?.addEventListener('change', (evt: Event) => {
  const target = evt.target as HTMLSelectElement;
  const newFftSize = parseInt(target.selectedOptions[0].text);
  if(audioManager) audioManager.changeFftSize(newFftSize);
});

['lightX', 'lightY', 'lightZ'].forEach(axis => {
  const control = document.getElementById(axis);
  if(control){
    control.addEventListener('input', (evt: Event) => {
      const target = evt.target as HTMLInputElement;
      const val = parseInt(target.value);
      const text = document.getElementById(`${axis}Value`);
      if(text) text.textContent = `${val}`;
      if(sceneManager) sceneManager.updateSceneLighting(axis, val);
    });
  }
});

toggleWireframeCheckbox?.addEventListener('change', () => {
  sceneManager.toggleWireframe();
});

// 3d stuff setup
const sceneManager = new SceneManager((canvasContainer as HTMLCanvasElement)); // initializes a scene
const renderer = sceneManager.renderer;
const scene = sceneManager.scene;
const camera = sceneManager.camera;

// stuff has loaded, hide loading message
if(loadingMsg) loadingMsg.style.display = 'none';

visualizer = new Waveform('waveform', sceneManager, audioManager, 50);
visualizer.init();

update();
