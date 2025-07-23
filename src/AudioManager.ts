// TODO: need web audio types
export class AudioManager {
  audioContext:            AudioContext;
  mediaStreamDestination:  MediaStreamAudioDestinationNode
  analyser:                AnalyserNode;
  buffer:                  Uint8Array;
  audioSource:             AudioBufferSourceNode;
  audioFileUrl = '';
  isPlaying = false;
  audioDurationInMs = 0;
  
  // for displaying waveform of audio
  waveformCanvas:             HTMLCanvasElement | null;
  waveformDisplayAnimationId: number;
  waveformCanvasId = 'waveformCanvas';
  
  constructor(){
    // set up web audio stuff
    const audioCtx = new AudioContext();
    const analyser = audioCtx.createAnalyser(); // default fft size is 2048
    const bufferLength = analyser.frequencyBinCount;
    const buffer = new Uint8Array(bufferLength);
    
    // for recording
    const audioStream = audioCtx.createMediaStreamDestination();
    
    this.audioContext = audioCtx;
    this.analyser = analyser;
    this.buffer = buffer;
    this.mediaStreamDestination = audioStream;
    
    // for waveform visualization (separate from the main visualizer)
    const waveformCanvasEl = document.getElementById(this.waveformCanvasId) as HTMLCanvasElement;
    this.waveformCanvas = waveformCanvasEl;
  }
  
  loadAudioFile(url: string){
    this.audioFileUrl = url;
    this.audioSource = this.audioContext.createBufferSource();
    
    const req = new XMLHttpRequest();
    req.open("GET", url, true);
    req.responseType = 'arraybuffer';
    req.onload = () => {
      this.audioContext.decodeAudioData(req.response, (buffer: AudioBuffer) => {
        if (!this.audioSource.buffer) this.audioSource.buffer = buffer;
        this.audioSource.connect(this.analyser);
        this.audioSource.connect(this.audioContext.destination);
        this.audioSource.connect(this.mediaStreamDestination);
        
        // https://stackoverflow.com/questions/71118040/getting-the-duration-of-an-mp3-file-in-a-variable
        this.audioDurationInMs = buffer.duration * 1000; // convert to ms
      });
    };
    
    req.send();
  };
  
  // stuff for loading in an audio file.
  // TODO: can this stuff be simplified? seems like a bit much
  setupInput(button: HTMLButtonElement){
    const openFile = (function(){
      return function(handleFileFunc: (f: File) => void){
        //if(isPlaying) return;
           
        const fileInput = document.getElementById('fileInput');
           
        function onFileChange(evt: Event){
          const files = (evt.target as HTMLInputElement).files;
          if(files && files.length > 0){
            handleFileFunc(files[0]);
          }
        }
           
        fileInput?.addEventListener("change", onFileChange, false);
        fileInput?.click();
      }; 
    })();

    const handleFile = (file: File) => {
      const audioFileUrl = URL.createObjectURL(file);
      const type = /audio.*/;
      if(!file.type.match(type)){
        return;
      }
        
      const reader = new FileReader();
      reader.onload = (function(f){
        return function(){
          const filenameElement = document.getElementById('audioFileName');
          if(filenameElement) filenameElement.textContent = f.name;
        };
      })(file);
        
      reader.readAsDataURL(file);
      this.loadAudioFile(audioFileUrl);
    }
    
    button.addEventListener("click", () => {
      if(this.isPlaying) return;
      openFile(handleFile);
    });
  }
  
  loadExample(){
    const example = "/assets/080415pianobgm3popver-edit-steinway.wav";
    this.loadAudioFile(example);
    const filenameElement = document.getElementById('audioFileName');
    if(filenameElement) filenameElement.textContent = "080415pianobgm3popver-edit-steinway.wav"; 
  }
  
  play(){
    if(!this.isPlaying){
      this.audioSource?.start();
      this.isPlaying = true;
      this.doWaveformVisualization();
    }
  }
  
  stop(){
    if(this.isPlaying){
      this.audioSource?.stop();
      this.isPlaying = false;
      
      // reload since we can't restart buffer source
      if(this.audioFileUrl) this.loadAudioFile(this.audioFileUrl);
    }
  }
  
  changeFftSize(newFftSize: number){
    this.analyser.fftSize = newFftSize;
    
    // also update buffer accordingly
    this.buffer = new Uint8Array(this.analyser.frequencyBinCount);
  }
  
  doWaveformVisualization(){
    if(this.waveformCanvas === null || !this.isPlaying){
      console.log('stopping waveform animation');
      cancelAnimationFrame(this.waveformDisplayAnimationId);
      return;
    }
    
    const canvasCtx = this.waveformCanvas.getContext('2d');
    const width = (this.waveformCanvas as HTMLCanvasElement).width;
    const height = (this.waveformCanvas as HTMLCanvasElement).height;
    const bufferLen = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLen);
    
    if(canvasCtx){
        this.analyser.getByteTimeDomainData(dataArray);
        canvasCtx.fillStyle = 'rgb(200, 200, 200)';
        canvasCtx.fillRect(0, 0, width, height);
        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = 'rgb(0, 0, 0)';
        canvasCtx.beginPath();
        
        const sliceWidth = width / bufferLen;
        let xPos = 0;
        
        for(let i = 0; i < bufferLen; i++){
            const dataVal = dataArray[i] / 128.0; // why 128?
            const yPos = dataVal * (height/2);
            
            if(i === 0){
                canvasCtx!.moveTo(xPos, yPos);
            }else{
                canvasCtx!.lineTo(xPos, yPos);
            }
            
            xPos += sliceWidth;
        }
        
        canvasCtx.stroke();
        
        this.waveformDisplayAnimationId = requestAnimationFrame(this.doWaveformVisualization.bind(this));
    }
  }
}