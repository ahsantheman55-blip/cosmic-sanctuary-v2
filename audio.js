/* Cosmic Sanctuary audio: the Web Audio graph, real-recording players, synthesised cosmos voices, teaching motifs,
   binaural beats, noise and singing bowls. The journey engine says what should play; this file makes it sound.
   To add a synth voice: add a function to SYNTH below and a level in an era recipe in eras.js. */
(function(root){
'use strict';
var TAU=Math.PI*2;
function clamp(x,a,b){ return x<a?a:x>b?b:x; }
function rand(a,b){ return a+Math.random()*(b-a); }
function pick(a){ return a[Math.floor(Math.random()*a.length)]; }
function ramp(p,v,t,tc){ try{ p.cancelScheduledValues(t); p.setValueAtTime(p.value,t); p.setTargetAtTime(v,t,Math.max(0.01,tc)); }catch(e){ p.value=v; } }
function lin(p,v,t,d){ try{ p.cancelScheduledValues(t); p.setValueAtTime(p.value,t); p.linearRampToValueAtTime(v,t+Math.max(0.02,d)); }catch(e){ p.value=v; } }
function stopAt(n,t){ try{ n.stop(t); }catch(e){} }

function Cosmos(ctx,loader){ var C=this; this.ctx=ctx; this.loader=loader; this.t0=ctx.currentTime;
  var g=function(v){ var n=ctx.createGain(); n.gain.value=v==null?1:v; return n; };
  this.g=g;
  // output: master -> limiter -> duck -> timer -> out
  this.out=g(1); this.timerG=g(1); this.duckG=g(1); this.master=g(0.8);
  var lim=ctx.createDynamicsCompressor(); lim.threshold.value=-10; lim.knee.value=8; lim.ratio.value=8; lim.attack.value=0.005; lim.release.value=0.35;
  this.master.connect(lim); lim.connect(this.duckG); this.duckG.connect(this.timerG); this.timerG.connect(this.out);
  // stereo matrix for the field (everything except binaural) and a separate one for binaural (mono and swap only)
  this.fieldM=this.matrix(this.master); this.binM=this.matrix(this.master);
  // crossfeed (for headphones and close speakers): a little of each side, delayed and darkened, into the other
  this.field=g(1); var sp=ctx.createChannelSplitter(2), mg=ctx.createChannelMerger(2); this.field.connect(sp);
  sp.connect(mg,0,0); sp.connect(mg,1,1); this.cf=[];
  for(var i=0;i<2;i++){ var d=ctx.createDelay(0.01); d.delayTime.value=0.00035; var lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=750; var cg=g(0);
    sp.connect(d,i); d.connect(lp); lp.connect(cg); cg.connect(mg,0,1-i); this.cf.push(cg); }
  mg.connect(this.fieldM.input);
  // the cosmos bus (real + synth) goes through the slow filter sweep
  this.sweep=ctx.createBiquadFilter(); this.sweep.type='lowpass'; this.sweep.frequency.value=3000; this.sweep.Q.value=0.6; this.sweep.connect(this.field);
  this.cosmos=g(1); this.cosmos.connect(this.sweep);
  // smear: a long synthetic reverb, shared send
  this.verb=ctx.createConvolver(); this.verb.buffer=this.impulse(5.5); this.verbRet=g(0.35); this.verb.connect(this.verbRet); this.verbRet.connect(this.field);
  this.send=g(0.5); this.send.connect(this.verb);
  // groups
  this.groups={}; var self=this;
  ['real','synth','motifs','noise','bowls','binaural'].forEach(function(k){ self.groups[k]=g(0); });
  this.groups.real.connect(this.cosmos); this.groups.synth.connect(this.cosmos);
  this.groups.real.connect(this.send); this.groups.synth.connect(this.send);
  this.groups.motifs.connect(this.field); this.groups.motifs.connect(this.send);
  this.groups.noise.connect(this.field); this.groups.bowls.connect(this.field); this.groups.bowls.connect(this.send);
  this.groups.binaural.connect(this.binM.input);
  this.real={}; this.synth={}; this.mix=null; this.p={width:1,mono:false,swap:false,sweep:0.5,mod:0.5,pitchDrift:0.3,driftSpeed:0.4,eraWidth:0.8,widthBoost:1};
  this.nb=this.noiseBuffers(); this.events={}; this.bin=null; this.noiseV=null; this.bowlsNext=0; this.solf=null; this.lastTick=ctx.currentTime;
}
Cosmos.prototype.now=function(){ return this.ctx.currentTime; };
Cosmos.prototype.matrix=function(dest){ var ctx=this.ctx, sp=ctx.createChannelSplitter(2), mg=ctx.createChannelMerger(2), inp=ctx.createGain();
  inp.channelCount=2; inp.channelCountMode='explicit'; inp.connect(sp); var m={input:inp,gl:[],gr:[]};
  for(var o=0;o<2;o++) for(var i=0;i<2;i++){ var gg=ctx.createGain(); gg.gain.value=(o===i)?1:0; sp.connect(gg,i); gg.connect(mg,0,o); (o===0?m.gl:m.gr)[i]=gg; }
  mg.connect(dest); return m; };
Cosmos.prototype.setMatrix=function(m,w,mono,swap,tc){ if(mono) w=0; var a=(1+w)/2, b=(1-w)/2, t=this.now(); tc=tc==null?0.3:tc;
  var LL=a,LR=b,RL=b,RR=a; if(swap){ LL=b; LR=a; RL=a; RR=b; }
  ramp(m.gl[0].gain,LL,t,tc); ramp(m.gl[1].gain,LR,t,tc); ramp(m.gr[0].gain,RL,t,tc); ramp(m.gr[1].gain,RR,t,tc); };
Cosmos.prototype.applyField=function(tc){ var w=this.p.width*this.p.eraWidth*this.p.widthBoost; this.setMatrix(this.fieldM,clamp(w,0,1.5),this.p.mono,this.p.swap,tc); this.setMatrix(this.binM,1,this.p.mono,this.p.swap,0.1); };
Cosmos.prototype.impulse=function(sec){ var ctx=this.ctx, n=Math.floor(ctx.sampleRate*sec), b=ctx.createBuffer(2,n,ctx.sampleRate);
  for(var c=0;c<2;c++){ var d=b.getChannelData(c), lp=0; for(var i=0;i<n;i++){ var x=Math.random()*2-1; lp=lp*0.6+x*0.4; var t=i/n; d[i]=(c?lp:x*0.7+lp*0.3)*Math.pow(1-t,2.6)*(t<0.02?t/0.02:1)*0.6; } } return b; };
Cosmos.prototype.noiseBuffers=function(){ var ctx=this.ctx, sr=ctx.sampleRate, n=Math.floor(sr*7), o={};
  ['white','pink','brown'].forEach(function(kind){ var b=ctx.createBuffer(2,n,sr);
    for(var c=0;c<2;c++){ var d=b.getChannelData(c), b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0,last=0;
      for(var i=0;i<n;i++){ var w=Math.random()*2-1;
        if(kind==='white') d[i]=w*0.35;
        else if(kind==='pink'){ b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0750759; b2=0.96900*b2+w*0.1538520; b3=0.86650*b3+w*0.3104856; b4=0.55000*b4+w*0.5329522; b5=-0.7616*b5-w*0.0168980; d[i]=(b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.09; b6=w*0.115926; }
        else { last=(last+0.02*w)/1.02; d[i]=last*3.2; } }
      // crossfade the loop seam
      var f=Math.floor(sr*0.25); for(var k=0;k<f;k++){ var a=k/f; d[n-f+k]=d[n-f+k]*(1-a)+d[k]*a; } }
    o[kind]=b; }); return o; };
Cosmos.prototype.noiseSrc=function(kind,rate){ var s=this.ctx.createBufferSource(); s.buffer=this.nb[kind]; s.loop=true; s.loopStart=0.25; s.loopEnd=this.nb[kind].duration-0.001; if(rate) s.playbackRate.value=rate; s.start(this.now(),rand(0.3,6)); return s; };

/* ---------- groups and global parameters ---------- */
Cosmos.prototype.setGroup=function(k,on,vol){ var v=on?Math.pow(clamp(vol/100,0,1),1.6)*(k==='binaural'?0.5:1):0; ramp(this.groups[k].gain,v,this.now(),0.4); };
Cosmos.prototype.setParams=function(s){ var P=this.p, t=this.now();
  ramp(this.master.gain,Math.pow(s.space.master/100,1.5),t,0.2);
  P.width=s.space.width/100; P.mono=s.space.mono; P.swap=s.space.swap; this.applyField(0.3);
  var cf=s.space.crossfeed/100*0.45; this.cf.forEach(function(n){ ramp(n.gain,cf,t,0.3); });
  P.sweep=s.space.sweep/100; P.mod=s.space.mod/100; P.pitchDrift=s.space.pitchDrift/100; P.driftSpeed=s.journey.driftSpeed/100; P.cues=s.space.cues;
  ramp(this.verbRet.gain,0.08+s.space.smear/100*0.75,t,0.5);
  var G=s.groups; for(var k in G) this.setGroup(k,G[k].on,G[k].vol);
  this.setBinaural(s.binaural,G.binaural.on); this.setNoise(s.noise,G.noise.on); this.bowlSet=s.bowls; this.bowlsOn=G.bowls.on;
  if(!G.bowls.on) this.bowlsNext=0; };

/* ---------- real recordings: random sections with long crossfades, slow panning and pitch drift ---------- */
function RealVoice(C,id){ this.C=C; this.id=id; var ctx=C.ctx; this.out=ctx.createGain(); this.out.gain.value=0; this.pan=ctx.createStereoPanner?ctx.createStereoPanner():null;
  if(this.pan){ this.out.connect(this.pan); this.pan.connect(C.groups.real); } else this.out.connect(C.groups.real);
  this.buf=null; this.next=0; this.srcs=[]; this.level=0; this.basePan=0; this.rate=1; this.phase=rand(0,TAU); this.period=rand(50,130); this.alive=true; this.gphase=rand(0,TAU); }
RealVoice.prototype.set=function(level,pan,rate,fade){ var t=this.C.now(); this.level=level; this.basePan=pan; this.rate=rate; lin(this.out.gain,level,t,fade); };
RealVoice.prototype.fadeOut=function(fade){ var t=this.C.now(), self=this; this.level=0; this.alive=false; lin(this.out.gain,0,t,fade);
  this.srcs.forEach(function(s){ stopAt(s,t+fade+0.2); }); setTimeout(function(){ try{ self.out.disconnect(); if(self.pan) self.pan.disconnect(); }catch(e){} },(fade+1)*1000); };
RealVoice.prototype.tick=function(t){ if(!this.alive||!this.buf) return; var P=this.C.p, ctx=this.C.ctx;
  if(this.pan){ var depth=0.15+0.75*P.mod, sp=0.6+P.driftSpeed; var pv=clamp(this.basePan+depth*Math.sin(TAU*t/(this.period/sp)+this.phase),-1,1); ramp(this.pan.pan,pv,t,1.2); }
  while(this.next<t+3){ var d=this.buf.duration, L=Math.min(d,rand(18,42)), X=Math.min(7,Math.max(0.5,L/3)), st=Math.max(this.next,t), off=d>L?rand(0,d-L):0;
    var s=ctx.createBufferSource(), e=ctx.createGain(); s.buffer=this.buf; var r=this.rate*(1+P.pitchDrift*0.05*Math.sin(TAU*st/97+this.gphase));
    s.playbackRate.value=clamp(r,0.5,2); s.connect(e); e.connect(this.out);
    var real=L/s.playbackRate.value; e.gain.setValueAtTime(0,st); e.gain.linearRampToValueAtTime(1,st+X); e.gain.setValueAtTime(1,st+Math.max(X,real-X)); e.gain.linearRampToValueAtTime(0,st+real);
    s.start(st,off,L); s.stop(st+real+0.05); var self=this; this.srcs.push(s); s.onended=function(){ var i=self.srcs.indexOf(this); if(i>=0) self.srcs.splice(i,1); };
    this.next=st+real-X; } };
Cosmos.prototype.oneShot=function(id,gain,pan,rate,solo){ var C=this; return this.loader(id).then(function(buf){ if(!buf) return; var ctx=C.ctx, s=ctx.createBufferSource(), e=ctx.createGain(), t=C.now(), dest=solo?C.motifSolo():C.groups.real; C._preview=s;
  s.buffer=buf; s.playbackRate.value=rate||1; e.gain.value=gain; s.connect(e); var p=ctx.createStereoPanner?ctx.createStereoPanner():null; if(p){ p.pan.value=pan||0; e.connect(p); p.connect(dest); } else e.connect(dest); s.start(t+0.05); return buf.duration; }); };
Cosmos.prototype.stopPreview=function(){ if(this._preview) stopAt(this._preview,0); this._preview=null; };

/* ---------- synthesised cosmos voices ---------- */
var SYNTH={};
function osc(C,type,f){ var o=C.ctx.createOscillator(); o.type=type; o.frequency.value=f; o.start(); return o; }
function lfo(C,f,depth,param){ var o=osc(C,'sine',f), g=C.g(depth); o.connect(g); g.connect(param); return o; }
function filt(C,type,f,q){ var b=C.ctx.createBiquadFilter(); b.type=type; b.frequency.value=f; b.Q.value=q==null?0.7:q; return b; }
function panner(C,v){ var p=C.ctx.createStereoPanner?C.ctx.createStereoPanner():C.g(1); if(p.pan) p.pan.value=v||0; return p; }
SYNTH.hiss=function(C,out){ var s=C.noiseSrc('white'), bp=filt(C,'bandpass',2500,0.5), a=C.g(0.9); s.connect(bp); bp.connect(a); a.connect(out);
  var s2=C.noiseSrc('pink'), hp=filt(C,'highpass',4000), a2=C.g(0.5); s2.connect(hp); hp.connect(a2); a2.connect(out);
  return { nodes:[s,s2], tick:function(t,m){ var mod=C.p.mod*(m?m.mod:1); ramp(bp.frequency,clamp(800+Math.random()*5500*mod,300,9000),t,rand(0.4,3)); ramp(a.gain,0.5+Math.random()*0.6*mod,t,rand(0.2,2)); } }; };
SYNTH.plasma=function(C,out){ var s=C.noiseSrc('brown'), lp=filt(C,'lowpass',350,5), a=C.g(1.4); s.connect(lp); lp.connect(a); a.connect(out);
  var s2=C.noiseSrc('pink'), bp=filt(C,'bandpass',220,2.5), a2=C.g(0.6); s2.connect(bp); bp.connect(a2); a2.connect(out);
  return { nodes:[s,s2], tick:function(t,m){ var mod=C.p.mod; ramp(lp.frequency,rand(120,650),t,rand(1,4)*(1.5-mod)); ramp(bp.frequency,rand(120,420),t,2); ramp(a2.gain,rand(0.2,0.9)*mod+0.2,t,0.8); } }; };
SYNTH.drone=function(C,out,mix){ var roots=[55,61.74,65.41,73.42], f0=pick(roots), lp=filt(C,'lowpass',900,0.8), a=C.g(0.22); lp.connect(a); a.connect(out);
  var ratios=[1,1.5,2,3], os=ratios.map(function(r,i){ var o=osc(C,i%2?'triangle':'sawtooth',f0*r); var gg=C.g(i===0?0.6:0.35/(i)); var p=panner(C,(i%2?-1:1)*0.4*i/3); o.connect(gg); gg.connect(p); p.connect(lp); o._g=gg; return o; });
  var dis=osc(C,'sine',f0*16/15*2), dg=C.g(0); dis.connect(dg); dg.connect(lp);
  var startT=C.now();
  return { nodes:os.concat([dis]), tick:function(t,m){ if(!m) return; ramp(lp.frequency,clamp(m.cutoff*0.35,180,2500),t,4);
    var stretch=m.pitch<1?Math.pow(m.pitch,Math.min(1,(t-startT)/240)):1; os.forEach(function(o,i){ ramp(o.frequency,f0*ratios[i]*stretch*(1+(Math.random()-0.5)*0.002*C.p.mod),t,6); ramp(o.detune,(i%2?1:-1)*m.detune*0.4,t,3); });
    ramp(dg.gain,m.detune/30*0.12,t,4); } }; };
SYNTH.shimmer=function(C,out){ var a=C.g(0.18); a.connect(out); var notes=[880,987.8,1174.7,1318.5,1568,1760,1975.5,2349.3,2637], os=[];
  for(var i=0;i<6;i++){ var o=osc(C,'sine',pick(notes)*(Math.random()<0.3?2:1)), gg=C.g(0), p=panner(C,rand(-0.9,0.9)); o.connect(gg); gg.connect(p); p.connect(a); o._g=gg; o._next=0; os.push(o); }
  return { nodes:os, tick:function(t){ os.forEach(function(o){ if(t>o._next){ var d=rand(3,11); o._next=t+d; lin(o._g.gain,Math.random()<0.6?rand(0.1,0.35):0,t,d*0.9); if(Math.random()<0.2) ramp(o.frequency,pick(notes)*(Math.random()<0.3?2:1),t+d*0.8,0.5); } }); } }; };
SYNTH.sub=function(C,out){ var o=osc(C,'sine',rand(36,44)), o2=osc(C,'sine',o.frequency.value*2.003), g1=C.g(0.9), g2=C.g(0.15), a=C.g(0.7); o.connect(g1); o2.connect(g2); g1.connect(a); g2.connect(a); a.connect(out);
  var l=lfo(C,1/rand(20,40),0.3,a.gain); return { nodes:[o,o2,l] }; };
SYNTH.rumble=function(C,out){ var s=C.noiseSrc('brown',0.7), lp=filt(C,'lowpass',85,1.2), a=C.g(2.2); s.connect(lp); lp.connect(a); a.connect(out);
  var o=osc(C,'sine',rand(27,33)), og=C.g(0.5); o.connect(og); og.connect(out); var l=lfo(C,rand(0.05,0.11),0.35,og.gain), l2=lfo(C,rand(0.03,0.07),0.8,a.gain);
  return { nodes:[s,o,l,l2], tick:function(t){ ramp(lp.frequency,rand(55,120),t,3); } }; };
SYNTH.beating=function(C,out){ var f=pick([82.41,98,110]), a=C.g(0.32); a.connect(out); var o1=osc(C,'triangle',f), o2=osc(C,'triangle',f+0.15), p1=panner(C,-0.85), p2=panner(C,0.85), lp=filt(C,'lowpass',700);
  o1.connect(p1); o2.connect(p2); p1.connect(lp); p2.connect(lp); lp.connect(a); var st=C.now();
  return { nodes:[o1,o2], tick:function(t){ var k=((t-st)%180)/180; var d=0.12+k*1.6; ramp(o2.frequency,f+d,t,2); if(p1.pan){ ramp(p1.pan.pan,-0.85*(1-k)-0.05,t,2); ramp(p2.pan.pan,0.85*(1-k)+0.05,t,2); } } }; };
SYNTH.grit=function(C,out){ var a=C.g(0.9); a.connect(out); var st=C.now(), next=0, centres=[rand(-0.7,-0.2),rand(0.2,0.7)];
  return { nodes:[], tick:function(t,m){ var dens=(3+9*C.p.mod)*(m?m.eventRate:1), k=Math.min(1,(t-st)/200);
    while(next<t+1.2){ next=Math.max(next,t)+(-Math.log(1-Math.random()))/dens; var s=C.ctx.createBufferSource(); s.buffer=C.nb.white; var bp=filt(C,'bandpass',rand(900,7000),rand(4,12)), e=C.g(0), p=panner(C,0);
      var spread=rand(-1,1), c=pick(centres); if(p.pan) p.pan.value=clamp(spread*(1-k)+c*k+rand(-0.08,0.08),-1,1);
      s.connect(bp); bp.connect(e); e.connect(p); p.connect(a); var len=rand(0.006,0.045), amp=rand(0.3,1.4); e.gain.setValueAtTime(0,next); e.gain.linearRampToValueAtTime(amp,next+0.002); e.gain.exponentialRampToValueAtTime(0.0005,next+len);
      s.start(next,rand(0,6)); s.stop(next+len+0.02); } } }; };
function swell(C,out,freqs,dur,bright,pan,type){ var t=C.now()+0.05, a=C.g(0), lp=filt(C,'lowpass',300,1), p=panner(C,pan||0); lp.connect(a); a.connect(p); p.connect(out);
  var os=freqs.map(function(f,i){ var o=C.ctx.createOscillator(); o.type=type||(i?'triangle':'sine'); o.frequency.value=f; o.detune.value=rand(-6,6); var gg=C.g(1/freqs.length); o.connect(gg); gg.connect(lp); o.start(t); o.stop(t+dur+0.5); return o; });
  a.gain.setValueAtTime(0,t); a.gain.linearRampToValueAtTime(0.5,t+dur*0.45); a.gain.setValueAtTime(0.5,t+dur*0.6); a.gain.linearRampToValueAtTime(0,t+dur);
  lp.frequency.setValueAtTime(250,t); lp.frequency.exponentialRampToValueAtTime(bright||3000,t+dur*0.5); lp.frequency.exponentialRampToValueAtTime(600,t+dur); return os; }
SYNTH.ignite=function(C,out){ var a=C.g(0.8); a.connect(out); var next=C.now()+rand(4,15), chords=[[220,277.2,329.6],[196,246.9,293.7,392],[261.6,329.6,392,523.3],[174.6,220,261.6]];
  return { nodes:[], tick:function(t,m){ if(t<next) return; var ch=pick(chords); swell(C,a,ch.map(function(f){ return f*(Math.random()<0.3?2:1); }),rand(9,16),rand(2500,6000),rand(-0.8,0.8)); next=t+rand(22,60)/((m?m.eventRate:1)); } }; };
function bloom(C,out,send){ var t=C.now()+0.05, ctx=C.ctx; var o=ctx.createOscillator(); o.type='sine'; o.frequency.setValueAtTime(70,t); o.frequency.exponentialRampToValueAtTime(28,t+2.5); var og=C.g(0); o.connect(og); og.connect(out);
  og.gain.setValueAtTime(0,t); og.gain.linearRampToValueAtTime(0.9,t+0.08); og.gain.exponentialRampToValueAtTime(0.001,t+4); o.start(t); o.stop(t+4.2);
  var s=ctx.createBufferSource(); s.buffer=C.nb.pink; var lp=filt(C,'lowpass',200,1.5), ng=C.g(0), p=panner(C,rand(-0.6,0.6)); s.connect(lp); lp.connect(ng); ng.connect(p); p.connect(out); if(send) p.connect(send);
  lp.frequency.setValueAtTime(150,t); lp.frequency.exponentialRampToValueAtTime(rand(3000,7000),t+3); lp.frequency.exponentialRampToValueAtTime(300,t+16);
  ng.gain.setValueAtTime(0,t); ng.gain.linearRampToValueAtTime(1.1,t+1.5); ng.gain.exponentialRampToValueAtTime(0.001,t+17); s.start(t,rand(0,5)); s.stop(t+17.2); }
SYNTH.bloom=function(C,out){ var a=C.g(0.9); a.connect(out); var next=C.now()+rand(8,25);
  return { nodes:[], tick:function(t,m){ if(t<next) return; bloom(C,a,C.send); next=t+rand(55,150)/((m?m.eventRate:1)); } }; };
function clickLoop(C,rate){ var sr=C.ctx.sampleRate, n=Math.round(sr/rate), b=C.ctx.createBuffer(1,n,sr), d=b.getChannelData(0); for(var i=0;i<Math.min(n,200);i++) d[i]=(Math.random()*2-1)*Math.exp(-i/25);
  var s=C.ctx.createBufferSource(); s.buffer=b; s.loop=true; return s; }
SYNTH.pulsar=function(C,out){ var a=C.g(0.6); a.connect(out); var vela=clickLoop(C,11.19), crab=clickLoop(C,29.6), bp=filt(C,'bandpass',2200,1.2), gv=C.g(0.9), gc=C.g(0), pv=panner(C,-0.4), pc=panner(C,0.4);
  vela.connect(gv); crab.connect(gc); gv.connect(pv); gc.connect(pc); pv.connect(bp); pc.connect(bp); bp.connect(a); vela.start(); crab.start(); var nx=0, on=0;
  return { nodes:[vela,crab], tick:function(t){ if(t<nx) return; nx=t+rand(25,50); on=1-on; lin(gv.gain,on?0.9:0.15,t,8); lin(gc.gain,on?0.1:0.6,t,8); } }; };
var CMB=[1,540/220,810/220];
SYNTH.cmb=function(C,out){ var a=C.g(0.22), lp=filt(C,'lowpass',1500); lp.connect(a); a.connect(out); var f0=110;
  var os=CMB.map(function(r,i){ var o=osc(C,i?'sine':'triangle',f0*r), gg=C.g([0.6,0.35,0.25][i]), p=panner(C,[0,-0.5,0.5][i]); o.connect(gg); gg.connect(p); p.connect(lp); lfo(C,1/rand(8,20),0.2,gg.gain); return o; });
  return { nodes:os }; };

/* ---------- teaching motifs (one-shots) ---------- */
var MOTIF={};
MOTIF.redshift=function(C,out,d){ d=d||26; var t=C.now()+0.05; [880,1108.7,1318.5].forEach(function(f,i){ var o=C.ctx.createOscillator(), gg=C.g(0), p=panner(C,[-0.5,0,0.5][i]); o.type='sine';
  o.frequency.setValueAtTime(f,t); o.frequency.exponentialRampToValueAtTime(f/2.2,t+d); o.connect(gg); gg.connect(p); p.connect(out); gg.gain.setValueAtTime(0,t); gg.gain.linearRampToValueAtTime(0.16,t+3); gg.gain.linearRampToValueAtTime(0.12,t+d*0.7); gg.gain.linearRampToValueAtTime(0,t+d); o.start(t); o.stop(t+d+0.1); }); return d; };
MOTIF.cooling=function(C,out){ var t=C.now()+0.05, d=22, s=C.ctx.createBufferSource(); s.buffer=C.nb.white; var bp=filt(C,'bandpass',440,0.4), ng=C.g(0); s.connect(bp); bp.connect(ng); ng.connect(out);
  bp.Q.setValueAtTime(0.4,t); bp.Q.exponentialRampToValueAtTime(90,t+d*0.75); ng.gain.setValueAtTime(0,t); ng.gain.linearRampToValueAtTime(0.9,t+2); ng.gain.linearRampToValueAtTime(1.6,t+d*0.6); ng.gain.linearRampToValueAtTime(0,t+d*0.85);
  s.start(t,rand(0,5)); s.stop(t+d); var o=C.ctx.createOscillator(), og=C.g(0); o.frequency.value=440; o.connect(og); og.connect(out); og.gain.setValueAtTime(0,t+d*0.45); og.gain.linearRampToValueAtTime(0.14,t+d*0.8); og.gain.linearRampToValueAtTime(0,t+d); o.start(t); o.stop(t+d+0.1); return d; };
MOTIF.symmetry=function(C,out){ var t=C.now()+0.05, d=32, targets=[110,138.59,164.81,220], lp=filt(C,'lowpass',1200), a=C.g(0); lp.connect(a); a.connect(out);
  a.gain.setValueAtTime(0,t); a.gain.linearRampToValueAtTime(0.22,t+4); a.gain.setValueAtTime(0.22,t+d-6); a.gain.linearRampToValueAtTime(0,t+d);
  targets.forEach(function(f,i){ var o=C.ctx.createOscillator(); o.type='sawtooth'; o.frequency.setValueAtTime(110,t); o.frequency.setValueAtTime(110,t+8); o.frequency.exponentialRampToValueAtTime(f,t+22); var p=panner(C,0), gg=C.g(0.25);
    if(p.pan){ p.pan.setValueAtTime(0,t+8); p.pan.linearRampToValueAtTime([-0.8,-0.3,0.3,0.8][i],t+22); } o.connect(gg); gg.connect(p); p.connect(lp); o.start(t); o.stop(t+d+0.1); }); return d; };
MOTIF.gravity=function(C,out){ var t0=C.now()+0.05, d=30, centres=[rand(-0.5,-0.25),rand(0.25,0.5)], notes=[523.3,587.3,659.3,784,880];
  for(var i=0;i<40;i++){ var t=t0+i*(d/40)+rand(0,0.3), k=i/40, o=C.ctx.createOscillator(), gg=C.g(0), p=panner(C,0); o.type='sine'; o.frequency.value=pick(notes)*(k>0.6?1:rand(0.98,1.02));
    if(p.pan) p.pan.value=clamp(rand(-1,1)*(1-k)+centres[i%2]*k,-1,1); o.connect(gg); gg.connect(p); p.connect(out); gg.gain.setValueAtTime(0,t); gg.gain.linearRampToValueAtTime(0.12+0.1*k,t+0.01); gg.gain.exponentialRampToValueAtTime(0.0005,t+0.9); o.start(t); o.stop(t+1); } return d; };
MOTIF.darkenergy=function(C,out){ var t=C.now()+0.05, d=30, self=C; [196,293.7].forEach(function(f,i){ var o=C.ctx.createOscillator(), gg=C.g(0), p=panner(C,0); o.type='triangle'; o.frequency.value=f;
  if(p.pan){ p.pan.setValueAtTime(0,t); p.pan.linearRampToValueAtTime(i?1:-1,t+d*0.8); } o.connect(gg); gg.connect(p); p.connect(out); gg.gain.setValueAtTime(0,t); gg.gain.linearRampToValueAtTime(0.13,t+5); gg.gain.linearRampToValueAtTime(0,t+d); o.start(t); o.stop(t+d+0.1); });
  self.p.widthBoost=1.3; self.applyField(8); setTimeout(function(){ self.p.widthBoost=1; self.applyField(12); },d*1000); return d; };
MOTIF.puzzle=function(C,out){ var t=C.now()+0.05, d=15; swell(C,out,[196,261.6,293.7,440.0*1.0],d,2200,0,'triangle'); return d; };
MOTIF.cmb=function(C,out){ var d=18; swell(C,out,CMB.map(function(r){ return 110*r; }),d,2500,0,'sine'); return d; };
MOTIF.ignition=function(C,out){ var d=14; swell(C,out,[220,329.6,440,554.4],d,6000,rand(-0.3,0.3)); return d; };
MOTIF.merger=function(C,out){ var t=C.now()+0.05, d=30, f=110, lp=filt(C,'lowpass',900), a=C.g(0); lp.connect(a); a.connect(out); a.gain.setValueAtTime(0,t); a.gain.linearRampToValueAtTime(0.3,t+4); a.gain.setValueAtTime(0.3,t+d-5); a.gain.linearRampToValueAtTime(0,t+d);
  [0,1].forEach(function(i){ var o=C.ctx.createOscillator(), p=panner(C,i?0.9:-0.9); o.type='triangle'; o.frequency.setValueAtTime(i?f+0.2:f,t); if(i){ o.frequency.linearRampToValueAtTime(f+3,t+d*0.75); o.frequency.linearRampToValueAtTime(f,t+d*0.9); }
    if(p.pan){ p.pan.setValueAtTime(i?0.9:-0.9,t); p.pan.linearRampToValueAtTime(0,t+d*0.85); } o.connect(p); p.connect(lp); o.start(t); o.stop(t+d+0.1); }); return d; };
MOTIF.chirp=function(C,out){ var t=C.now()+0.05, d=4, o=C.ctx.createOscillator(), gg=C.g(0); o.type='sine'; var n=40;
  for(var i=0;i<=n;i++){ var tt=i/n*d*0.97, f=35*Math.pow(1-tt/d,-0.375); o.frequency.setValueAtTime(Math.min(f,420),t+tt); }
  o.connect(gg); gg.connect(out); gg.gain.setValueAtTime(0,t); gg.gain.linearRampToValueAtTime(0.06,t+1); gg.gain.linearRampToValueAtTime(0.35,t+d*0.97); gg.gain.exponentialRampToValueAtTime(0.0005,t+d+0.25); o.start(t); o.stop(t+d+0.3); return d; };
MOTIF.pulsar=function(C,out){ var t=C.now()+0.05, d=15, bp=filt(C,'bandpass',2200,1.2); bp.connect(out); [[11.19,0,8],[29.6,8,15]].forEach(function(x){ var s=clickLoop(C,x[0]), gg=C.g(0); s.connect(gg); gg.connect(bp);
  gg.gain.setValueAtTime(0,t+x[1]); gg.gain.linearRampToValueAtTime(0.7,t+x[1]+0.5); gg.gain.setValueAtTime(0.7,t+x[2]-0.5); gg.gain.linearRampToValueAtTime(0,t+x[2]); s.start(t+x[1]); s.stop(t+x[2]+0.05); }); return d; };
MOTIF.bloom=function(C,out){ bloom(C,out,C.send); return 17; };
MOTIF.grit=function(C,out){ var v=SYNTH.grit(C,out), t0=C.now(), iv=setInterval(function(){ v.tick(C.now(),{eventRate:1.3}); },400); setTimeout(function(){ clearInterval(iv); },15000); return 15; };
Cosmos.prototype.motif=function(id,standalone){ var f=MOTIF[id]; if(!f) return 0; var out=standalone?this.motifSolo():this.groups.motifs; return f(this,out); };
Cosmos.prototype.motifSolo=function(){ if(!this._solo){ this._solo=this.g(0.9); this._solo.connect(this.field); this._solo.connect(this.send); } return this._solo; };
Cosmos.prototype.cue=function(kind){ if(!this.p.cues) return; var t=this.now()+0.05, s=this.ctx.createBufferSource(); s.buffer=this.nb.pink; var bp=filt(this,'bandpass',2000,2), gg=this.g(0); s.connect(bp); bp.connect(gg); gg.connect(this.groups.motifs);
  var d=kind==='rewind'?3:kind==='newuniverse'?6:4.5, f0=kind==='jumpforward'?300:3500, f1=kind==='jumpforward'?4000:250;
  bp.frequency.setValueAtTime(f0,t); bp.frequency.exponentialRampToValueAtTime(f1,t+d); gg.gain.setValueAtTime(0,t); gg.gain.linearRampToValueAtTime(kind==='rewind'?0.9:1.4,t+d*0.8); gg.gain.linearRampToValueAtTime(0,t+d); s.start(t,rand(0,4)); s.stop(t+d+0.1);
  if(kind!=='rewind') bloom(this,this.groups.motifs,null); };

/* ---------- applying a segment's mix ---------- */
Cosmos.prototype.applyMix=function(mix,fade,realOn){ var C=this, t=this.now(); this.mix=mix; var want={};
  if(realOn!==false) mix.real.forEach(function(r){ want[r.id]=r; });
  for(var id in this.real){ if(!want[id]){ this.real[id].fadeOut(fade); delete this.real[id]; } }
  mix.real.forEach(function(r){ if(!want[r.id]) return; var v=C.real[r.id];
    if(!v){ v=C.real[r.id]=new RealVoice(C,r.id); v.basePan=r.pan; v.rate=r.rate; v.level=r.gain; v.next=0;
      C.loader(r.id).then(function(buf){ if(!v.alive||!buf) return; v.buf=buf; v.next=C.now(); v.set(v.level,v.basePan,v.rate,fade); v.tick(C.now()); }).catch(function(){}); }
    else v.set(r.gain,r.pan,r.rate,fade); });
  var types={}; for(var k in mix.synth) types[k]=1;
  for(k in this.synth){ if(!types[k]){ var sv=this.synth[k]; delete this.synth[k]; lin(sv.g.gain,0,t,fade); (function(sv){ setTimeout(function(){ (sv.v.nodes||[]).forEach(function(n){ stopAt(n,0); }); try{ sv.g.disconnect(); }catch(e){} },(fade+1)*1000); })(sv); } }
  for(k in mix.synth){ var lv=mix.synth[k]; if(!SYNTH[k]) continue; var s=this.synth[k];
    if(!s){ var gg=this.g(0); gg.connect(this.groups.synth); s=this.synth[k]={g:gg,v:SYNTH[k](this,gg,mix)}; }
    lin(s.g.gain,lv,t,fade); }
  this.events={}; mix.events.forEach(function(e){ C.events[e.id]={every:e.every,next:t+rand(0.3,1)*e.every}; });
  this.p.eraWidth=mix.width; this.applyField(Math.max(2,fade/2)); };
Cosmos.prototype.tick=function(){ var t=this.now(), C=this, m=this.mix; this.lastTick=t;
  for(var id in this.real) this.real[id].tick(t);
  for(var k in this.synth){ var v=this.synth[k].v; if(v.tick) try{ v.tick(t,m); }catch(e){} }
  if(m){ var per=m.sweepPeriod*(1.4-this.p.driftSpeed*0.8), cut=m.cutoff*Math.pow(2,this.p.sweep*1.6*Math.sin(TAU*t/per)); ramp(this.sweep.frequency,clamp(cut,180,12000),t,1.5);
    if(this.groups.real.gain.value>0.001) for(id in this.events){ var e=this.events[id]; if(t>=e.next){ e.next=t+e.every*rand(0.7,1.3); this.oneShot(id,0.8,rand(-0.6,0.6),1); } } }
  if(this.bin) this.binTick(t);
  if(this.bowlsOn) this.bowlTick(t);
  if(this.solf) {} };

/* ---------- binaural beats, isochronic pulses and solfeggio ---------- */
var BANDS={delta:[1,3.5,2],theta:[4,7.5,6],alpha:[8,12,10],beta:[13,25,16],gamma:[32,42,40]};
Cosmos.prototype.setBinaural=function(b,on){ var C=this, t=this.now();
  if(on&&!this.bin){ var mg=this.ctx.createChannelMerger(2), l=osc(this,'sine',200), r=osc(this,'sine',206), g=this.g(0); l.connect(mg,0,0); r.connect(mg,0,1); mg.connect(g); g.connect(this.groups.binaural);
    var io=osc(this,'sine',200), ig=this.g(0), ia=this.g(0), ws=this.ctx.createWaveShaper(), curve=new Float32Array(256); for(var i=0;i<256;i++){ var x=i/127.5-1; curve[i]=x>0?Math.pow(Math.sin(x*Math.PI/2),0.6):0; } ws.curve=curve;
    var il=osc(this,'sine',6); il.connect(ws); ws.connect(ig.gain); io.connect(ig); ig.connect(ia); ia.connect(this.groups.binaural);
    this.bin={l:l,r:r,io:io,il:il,ia:ia,g:g,beat:6,next:0}; }
  if(!this.bin) return; var B=BANDS[b.band]||BANDS.theta; this.binCfg=b; this.bin.band=B; this.bin.carrier=b.carrier;
  if(this.bin.bandName!==b.band){ this.bin.bandName=b.band; this.bin.beat=B[2]; this.bin.next=t+60; }
  this.binSet(t,4); ramp(this.bin.g.gain,b.beats?1:0,t,0.4); ramp(this.bin.ia.gain,b.iso?Math.pow(b.isoVol/100,1.5)*0.6:0,t,0.4); };
Cosmos.prototype.binSet=function(t,tc){ var B=this.bin; ramp(B.l.frequency,B.carrier-B.beat/2,t,tc); ramp(B.r.frequency,B.carrier+B.beat/2,t,tc); ramp(B.io.frequency,B.carrier,t,tc); ramp(B.il.frequency,B.beat,t,tc); };
Cosmos.prototype.binTick=function(t){ var B=this.bin; if(!this.binCfg||!this.binCfg.drift||t<B.next) return; B.next=t+rand(40,90); var r=B.band; B.beat=clamp(r[2]*(1+rand(-0.18,0.18)),r[0],r[1]); this.binSet(t,15); };
Cosmos.prototype.setSolfeggio=function(f,vol){ var t=this.now();
  if(!f){ if(this.solf){ var s=this.solf; this.solf=null; lin(s.g.gain,0,t,2); setTimeout(function(){ stopAt(s.o,0); stopAt(s.l,0); },3000); } return; }
  if(!this.solf){ var o=osc(this,'sine',f), g=this.g(0); o.connect(g); g.connect(this.groups.binaural); var l=lfo(this,0.07,0.0,g.gain); this.solf={o:o,g:g,l:l}; }
  ramp(this.solf.o.frequency,f,t,0.5); ramp(this.solf.g.gain,Math.pow(vol/100,1.6)*0.5,t,0.6); };
/* ---------- noise ---------- */
Cosmos.prototype.setNoise=function(n,on){ var C=this, t=this.now(); if(!on&&!this.noiseV) return;
  if(!this.noiseV){ this.noiseV={}; ['pink','brown','white'].forEach(function(k){ var s=C.noiseSrc(k), g=C.g(0); s.connect(g); g.connect(C.groups.noise); C.noiseV[k]={s:s,g:g}; }); }
  for(var k in this.noiseV) ramp(this.noiseV[k].g.gain,Math.pow(n[k]/100,1.4)*(k==='white'?0.6:1),t,0.4); };
/* ---------- singing bowls ---------- */
Cosmos.prototype.bowlTick=function(t){ var b=this.bowlSet; if(!b||!this.bowlList) return; if(!this.bowlsNext){ this.bowlsNext=t+rand(3,12); return; } if(t<this.bowlsNext) return;
  this.bowlsNext=t+b.every*rand(0.6,1.4); var wc=b.crystal, wt=b.tibetan; if(wc+wt<=0) return; var kind=Math.random()*(wc+wt)<wc?'crystal':'tibetan';
  var list=this.bowlList.filter(function(x){ return x.kind===kind; }); if(!list.length) return; var it=pick(list), C=this, vol=Math.pow((kind==='crystal'?wc:wt)/100,1.3);
  this.loader(it.id).then(function(buf){ if(!buf) return; var s=C.ctx.createBufferSource(), g=C.g(vol), p=panner(C,rand(-0.6,0.6)); s.buffer=buf; s.playbackRate.value=rand(0.97,1.03); s.connect(g); g.connect(p); p.connect(C.groups.bowls); s.start(C.now()+0.05); }).catch(function(){}); };
Cosmos.prototype.bowlNow=function(kind){ this.bowlsNext=this.now()-1; var b=this.bowlSet; if(kind&&b){ this.bowlSet=Object.assign({},b,{crystal:kind==='crystal'?100:0,tibetan:kind==='tibetan'?100:0}); this.bowlTick(this.now()); this.bowlSet=b; } };
Cosmos.prototype.stopAll=function(fade){ fade=fade||2; var t=this.now(); for(var id in this.real){ this.real[id].fadeOut(fade); } this.real={};
  for(var k in this.synth){ var s=this.synth[k]; lin(s.g.gain,0,t,fade); (function(s){ setTimeout(function(){ (s.v.nodes||[]).forEach(function(n){ stopAt(n,0); }); },(fade+0.5)*1000); })(s); } this.synth={}; this.mix=null; this.events={}; };
var API={Cosmos:Cosmos,SYNTH:SYNTH,MOTIF:MOTIF,BANDS:BANDS};
if(typeof module!=='undefined'&&module.exports) module.exports=API; else root.CS_AUDIO=API;
})(this);
