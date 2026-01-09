/*
  WIP
  
  idea: use web worker for 3d visualizer rendering
  
  main obj: to render scene on a large canvas, e.g. 1920 x 1080
  so that recording quality is correct/matches 1080p, etc. 
  
  I think the current recording quality is still not right even given the right video bitrate
  and I believe it has to do with the resolution of the canvas since:
  1080p video, also known as Full HD, has a resolution of 1920 x 1080 pixels with a 16:9 aspect ratio (according to Gemini)
  
  Gemini also had this to say when I googled: "1080p video bitrate canvas html still blurry?"
  
  A blurry HTML canvas when displaying 1080p video is usually caused by a mismatch between the canvas element's intrinsic (bitmap) size and its CSS display size, or an issue with the device's pixel ratio. 
  Bitrate is less likely to be the primary issue if the source video itself is clear. 
  
  web worker will render 3d scene on offscreen canvas
  and we'll draw the resulting scene back to the main thread canvas (and scale it as needed)
  
  also might have some performance improvements as well?
  curious about any latency between audio and visualization start though - since audio will be handled via main thread and visualization is by web worker
*/


// global variables
let isPlaying = false;
let isRecording = false;
let recordingOn = false;
let mediaRecorder: MediaRecorder | null = null;
let capturedVideoChunks: Blob[] = [];
let expectedStopTime: number | null = null; // should be record start time + duration of imported audio as unix timestamp

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
const visualizerOptions = document.getElementById('visualizerSpecificOptions');
const showDrawer = document.getElementById('showDrawer');
const hideDrawer = document.getElementById('hideDrawer');
const bgColorPicker = document.getElementById('bgColorPicker');
const vizColorPicker = document.getElementById('vizColorPicker');
const fftSizeDropdown = document.getElementById('fftSizeSelect');
const toggleWireframeCheckbox = document.getElementById('toggleWireframeInput');
const importImageBtn = document.getElementById('importImage');
if(importImageBtn) (importImageBtn as HTMLButtonElement).disabled = true;
const removeImageBtn = document.getElementById('removeImage');
if(removeImageBtn) (removeImageBtn as HTMLButtonElement).disabled = true;

// stuff for canvas recording
// helpful! https://devtails.xyz/@adam/how-to-record-html-canvas-using-mediarecorder-and-export-as-video
// https://stackoverflow.com/questions/77130824/is-it-possible-to-bind-a-html-canvas-to-an-ffmpeg-javascript-port-to-get-a-video
// https://stackoverflow.com/questions/62863547/save-canvas-data-as-mp4-javascript
// https://stackoverflow.com/questions/76706744/whats-the-most-performant-way-to-encode-an-mp4-video-of-frames-from-a-webgl-can
// https://stackoverflow.com/questions/60882162/im-not-able-to-view-the-total-length-of-the-recorded-video-and-the-timelines
// https://stackoverflow.com/questions/39302814/mediastream-capture-canvas-and-audio-simultaneously
// about recording quality via MediaRecorder:
// https://groups.google.com/g/discuss-webrtc/c/D_yf0-vFRzY
// https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/videoBitsPerSecond
// https://stackoverflow.com/questions/65800159/how-do-you-determine-bitspersecond-for-media-recording
function getVideoBitsPerSecond(): number {
  const selectedOption = document.getElementById('recordingQuality');
  if(selectedOption === null){
    return 2500000; // default recording quality is 480p, which is 2.5 Mbps
  }
  
  return parseInt((selectedOption as HTMLSelectElement).value);
}

function startCanvasRecord(renderer: WebGLRenderer){
  if(!mediaRecorder){
    if(canvasContainer) canvasContainer.style.border = '3px solid #ff0000'; // red border
    
    const canvasStream = renderer.domElement.captureStream();
    
    const audioTrack = audioManager.mediaStreamDestination.stream.getAudioTracks()[0];
    canvasStream.addTrack(audioTrack); // make sure we record the audio too
    
    const videoBitsPerSec = getVideoBitsPerSecond();
    console.log(`recording video bits per second: ${videoBitsPerSec}`);
    
    mediaRecorder = new MediaRecorder(canvasStream, {videoBitsPerSecond: videoBitsPerSec, mimeType: 'video/webm'});
    
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
    
    expectedStopTime = Date.now() + audioManager.audioDurationInMs;
    console.log(`recording should stop @ ${expectedStopTime}, ${new Date(expectedStopTime)}`);
  }
}

function stopCanvasRecord(){
  if(mediaRecorder){
    if(canvasContainer) canvasContainer.style.border = '3px solid #aaff00'; // green border
    
    mediaRecorder.stop();
    mediaRecorder = null;
    expectedStopTime = null;
  }
}

// TODO: move this to a web worker script
function update(){
  renderer.render(scene, camera);
  requestAnimationFrame(update);
  if(visualizer && isPlaying){
    visualizer.update();
  }
  
  // if recording, check if now >= expectedStopTime and stop recording
  if(isRecording){
    const now = Date.now();
    if(expectedStopTime && now >= expectedStopTime){
      stopVisualization();
    }
  }
}

function playVisualization(){
  audioManager.play();
  isPlaying = true;
  
  if(recordingOn && !isRecording){
    console.log('starting record');
    startCanvasRecord(renderer);
    isRecording = true;
  }
}

function stopVisualization(){
  audioManager.stop();
  isPlaying = false;
  
  if(isRecording){
    console.log('stopping record');
    stopCanvasRecord();
    isRecording = false;
    
    // TODO: we'll probably need to send a message to the web worker to stop the visualization since the rendering
    // will be controlled via web worker 
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
  // the order in which we set these values appears to matter :/
  input.min = parameter.min.toString();
  input.max = parameter.max.toString();
  input.step = parameter.step.toString();
  input.value = parameter.value.toString();
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

// TODO: need to send msg to web worker?
// this one feels a bit tricky. maybe the web worker can send us a message back of the 
// selected visualizer's configurable params. 
// in this main thread I think we won't have access
// to the visualizer objects anymore since they should all be in the web worker 
function displayVisualizerConfigurableParams(visualizer: VisualizerBase){
  // clear visualizer-specific parameter section
  visualizerOptions?.replaceChildren();
  
  // add current visualizer-specific parameters
  let currParamName = '';
  const params = Object.keys(visualizer.configurableParams);
  params.forEach(p => {
    const param = visualizer.configurableParams[p];
    if(param?.doNotShow){
      return;
    }
    
    if(param?.parameterName !== currParamName){
      visualizerOptions?.appendChild(document.createElement('hr'));
      currParamName = param.parameterName || '';
    }
    
    if('isOn' in param){
      // simple on/off toggle
      const newToggleDiv = makeBoolToggle(p, param);
      visualizerOptions?.appendChild(newToggleDiv);
    }else{
      // slider
      const newSliderDiv = makeSlider(p, (param as ConfigurableParameterRange));
      visualizerOptions?.appendChild(newSliderDiv);
    }
  });
}

// TODO: need to send msg to web worker? this code should be placed in the web worker
// audioManager should stay here though with the main thread stuff (can't use web audio in a web worker anyway)
// when we change fftSize, we should send a message to the web worker about it?
function switchVisualizer(evt: Event){
  const selected = (evt.target as HTMLSelectElement).value;
  
  // reset camera in case it was rotated or moved
  camera.position.set(0, 2, 8);
  camera.rotation.set(0, 0, 0);
  
  // the pixels shader visualizer is kinda weird and still a bit mysterious to me so for now,
  // make sure we force reset the analyser fft to 2048 since that seems to be the only working option atm
  if(selected === 'pixels'){
    if(fftSizeDropdown) (fftSizeDropdown as HTMLSelectElement).value = "2048";
    const newFftSize = 2048;
    if(audioManager) audioManager.changeFftSize(newFftSize);
  }
  
  // only show image import/image clear buttons if the visualizer is the image visualizer
  if(selected === 'image'){
    if(importImageBtn) (importImageBtn as HTMLButtonElement).disabled = false;
    if(removeImageBtn) (removeImageBtn as HTMLButtonElement).disabled = false;
  }else{
    if(importImageBtn) (importImageBtn as HTMLButtonElement).disabled = true;
    if(removeImageBtn) (removeImageBtn as HTMLButtonElement).disabled = true;
  }
  
  // don't allow toggling fft size for the pixels shader visualizer
  if(selected === 'pixels'){
    if(fftSizeDropdown) (fftSizeDropdown as HTMLSelectElement).disabled = true;
  }else{
    if(fftSizeDropdown) (fftSizeDropdown as HTMLSelectElement).disabled = false;
  }
  
  if(toggleWireframeCheckbox) (toggleWireframeCheckbox as HTMLInputElement).checked = false;
  
  // TODO: send msg to web worker about changes like fftSize
  //if(visualizer) displayVisualizerConfigurableParams(visualizer);
}

// start
if(importAudioBtn) audioManager.setupInput((importAudioBtn as HTMLButtonElement));
audioManager.loadExample();

// setup some event listeners for buttons and inputs
playBtn?.addEventListener('click', playVisualization);
stopBtn?.addEventListener('click', stopVisualization);
vizSelect?.addEventListener('change', switchVisualizer);

toggleRecording?.addEventListener(
  'change', () => {
    recordingOn = !recordingOn;
  
    if(recordingOn){
      if(canvasContainer) canvasContainer.style.border = '3px solid #aaff00'; // green border
    }else{
      if(canvasContainer) canvasContainer.style.border = 'none';
    }
  }
);

showDrawer?.addEventListener('click', () => {
  if(drawer) (drawer as HTMLElement).style.display = 'block';
});

hideDrawer?.addEventListener('click', () => {
  if(drawer) (drawer as HTMLElement).style.display = 'none'; 
});

bgColorPicker?.addEventListener('change', (evt: Event) => {
  const target = evt.target as HTMLInputElement;
  // TODO: need to send msg to web worker? anything that updates the scenemanager should be a msg to web worker I think
  // since scene management should have to be done in the web worker
  if(sceneManager && target) sceneManager.updateSceneBackgroundColor(target.value);
});

vizColorPicker?.addEventListener('change', (evt: Event) => {
  const target = evt.target as HTMLInputElement;
  // TODO: need to send msg to web worker?
  if(sceneManager && target) sceneManager.changeVisualizationColor(target.value);
});

fftSizeDropdown?.addEventListener('change', (evt: Event) => {
  const target = evt.target as HTMLSelectElement;
  const newFftSize = parseInt(target.value);
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
      // TODO: need to send msg to web worker?
      if(sceneManager) sceneManager.updateSceneLighting(axis, val);
    });
  }
});

toggleWireframeCheckbox?.addEventListener('change', () => {
  sceneManager.toggleWireframe();
});

importImageBtn?.addEventListener('click', () => {
  // import image, create texture, apply it to all children of scene
  if(sceneManager){
    const input = document.createElement('input');
    input.type = 'file';
    input.addEventListener('change', getFile, false);
    input.click();
    
    function getFile(e: Event){
      const reader = new FileReader();
      
      const files = (e.target as HTMLInputElement)?.files
      
      if(files){
        const file = files[0];
      
        if(!file.type.match(/image.*/)){
            console.log("not a valid image");
            return;
        }
        
        reader.onloadend = function(){
          if(reader.result && typeof reader.result === 'string'){
            const newTexture = new TextureLoader().load(reader.result);
            // TODO: need to send msg to web worker?
            sceneManager.updateTexture(newTexture);
          }
        };
        reader.readAsDataURL(file);
      }
    }
  }
});

removeImageBtn?.addEventListener('click', () => {
  // remove texture from all children of scene
  if(sceneManager){
    // TODO: need to send msg to web worker?
    sceneManager.updateTexture(null);
  }
});

// setup web worker for rendering 3d scene
if(window.Worker){
  const worker = new Worker('worker.ts');
  
  // send msg
  // worker.postMessage();
  // worker.onmessage = (evt) => {};
  // msg: update configurable parameters
}else{
  console.log('web worker not available! :(');
}

// 3d stuff setup
// TODO: need to send msg to web worker for this set up. scene management should be handled in the web worker
// since it will be rendering to a big offscreen canvas. this should make the resolution more correct I think 
/* for recording quality (e.g. 1080p should be rendered on a 1920 x 1080 canvas initially)
const sceneManager = new SceneManager((canvasContainer as HTMLDivElement)); // initializes a scene
const renderer = sceneManager.renderer;
const scene = sceneManager.scene;
const camera = sceneManager.camera;

// stuff has loaded, hide loading message
if(loadingMsg) loadingMsg.style.display = 'none';

visualizer = new Waveform('waveform', sceneManager, audioManager, 50);
visualizer.init();
displayVisualizerConfigurableParams(visualizer);

update();
*/