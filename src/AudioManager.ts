// TODO: need web audio types
export class AudioManager {
  audioContext:            AudioContext;
  mediaStreamDestination:  MediaStreamAudioDestinationNode
  analyser:                AnalyserNode;
  buffer:                  Uint8Array;
  audioSource:             AudioBufferSourceNode;
  audioFileUrl = '';
  isPlaying = false;
  
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
  }
  
  loadAudioFile(url: string){
    this.audioFileUrl = url;
    this.audioSource = this.audioContext.createBufferSource();
    
    const req = new XMLHttpRequest();
    req.open("GET", url, true);
    req.responseType = 'arraybuffer';
    req.onload = () => {
      this.audioContext.decodeAudioData(req.response, (buffer) => {
        if (!this.audioSource.buffer) this.audioSource.buffer = buffer;
        this.audioSource.connect(this.analyser);
        this.audioSource.connect(this.audioContext.destination);
        this.audioSource.connect(this.mediaStreamDestination);
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
}