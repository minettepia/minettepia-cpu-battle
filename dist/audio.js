// Original Unity clips, with gesture-based browser audio activation.
export class BattleAudio {
  constructor(config) {
    this.config=config; this.enabled=true; this.volume=1; this.buffers=new Map();
    this.sources=new Set(); this.generation=0; this.musicLevel=1; this.fadeFrame=0;
    this.music=new Audio(config.audio.bgm); this.music.loop=true; this.music.preload='metadata';
    document.addEventListener('visibilitychange',()=>{
      if(document.hidden){this.music.pause();this.stopEffects();}
      else if(this.inMatch&&this.enabled)this.music.play().catch(()=>{});
    });
  }
  unlock() {
    if(!this.context){const C=window.AudioContext||window.webkitAudioContext;if(C){this.context=new C();this.master=this.context.createGain();this.master.connect(this.context.destination);}}
    this.context?.resume().catch(()=>{}); this.applyVolume();
  }
  async buffer(url) {
    if(!this.context||!url)return null;
    if(!this.buffers.has(url))this.buffers.set(url,fetch(url).then(r=>{if(!r.ok)throw Error('audio');return r.arrayBuffer();}).then(b=>this.context.decodeAudioData(b)).catch(()=>null));
    return this.buffers.get(url);
  }
  preload() {for(const [key,url] of Object.entries(this.config.audio))if(key!=='bgm')this.buffer(url);}
  async play(key,volume=.7,side=0) {
    if(!this.enabled||document.hidden)return;
    const generation=this.generation,url=this.config.audio[key]||this.config.voices[key];
    const buffer=await this.buffer(url);
    if(!buffer||generation!==this.generation||!this.enabled||document.hidden)return;
    const source=this.context.createBufferSource(),gain=this.context.createGain();
    source.buffer=buffer;gain.gain.value=volume;source.connect(gain);
    if(this.context.createStereoPanner){const pan=this.context.createStereoPanner();pan.pan.value=side*.35;gain.connect(pan);pan.connect(this.master);}else gain.connect(this.master);
    this.sources.add(source);source.onended=()=>{this.sources.delete(source);source.disconnect();gain.disconnect();};source.start();
  }
  startMusic() {this.unlock();this.inMatch=true;this.music.currentTime=0;this.musicLevel=0;this.applyVolume();if(this.enabled&&!document.hidden)this.music.play().catch(()=>{});this.preload();cancelAnimationFrame(this.fadeFrame);const started=performance.now(),duration=this.config.bgm.fadeSeconds*1000;const fade=()=>{if(!this.inMatch)return;this.musicLevel=Math.min(1,(performance.now()-started)/duration);this.applyVolume();if(this.musicLevel<1)this.fadeFrame=requestAnimationFrame(fade);};this.fadeFrame=requestAnimationFrame(fade);}
  applyVolume() {if(this.master)this.master.gain.value=this.enabled?this.volume:0;this.music.volume=this.enabled?this.volume*this.config.bgm.battleVolume*this.musicLevel:0;}
  setEnabled(value) {this.enabled=value;this.applyVolume();if(value){this.unlock();if(this.inMatch&&!document.hidden)this.music.play().catch(()=>{});}else{this.stopEffects();this.music.pause();}}
  setVolume(value) {this.volume=Math.max(0,Math.min(1,value));this.applyVolume();}
  stopEffects() {this.generation++;for(const s of this.sources)try{s.stop();}catch{}this.sources.clear();}
  stop() {this.inMatch=false;cancelAnimationFrame(this.fadeFrame);this.music.pause();this.stopEffects();}
}
