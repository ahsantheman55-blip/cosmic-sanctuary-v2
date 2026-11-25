/* Cosmic Sanctuary journey engine. Pure logic, no audio and no page: it plans where the journey goes next
   (eras, small rewinds, big jumps, new universes) and which layers play, at what levels, for each segment.
   Deterministic for a given seed, so a journey can be saved, resumed and tested. */
(function(root){
'use strict';
var ERAS_API=(typeof module!=='undefined'&&module.exports)?require('./eras.js'):root.CS_ERAS;
var ERAS=ERAS_API.ERAS, N=ERAS.length;
var ENDLESS_UNIVERSE=2*3600; // seconds for one full universe in endless mode

function next(r){ r.s=(r.s+0x6D2B79F5)|0; var t=r.s; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }
function rngFrom(seed){ return {s:(seed>>>0)||1}; }
function lerp(a,b,x){ return a+(b-a)*x; }
function clamp(x,a,b){ return x<a?a:x>b?b:x; }
function newSeed(){ return (Math.floor(Math.random()*4294967295)>>>0)||7; }

function weightsFor(r){ var w=[]; for(var i=0;i<N;i++) w.push(ERAS[i].weight*(0.85+0.3*next(r))); return w; }
function sum(a){ var s=0; for(var i=0;i<a.length;i++) s+=a[i]; return s; }
function budget(o){ var jf=o.jumpFreq; return o.motion==='drift'?0:o.motion==='rewind'?0.08+0.12*jf:0.12+0.18*jf; }
// distance still to travel, in weight units, from position x to the end of the last era
function remainingW(j,x){ var e=Math.floor(x), p=x-e, s=0; if(e>=N) return 0; s+=j.w[e]*(1-p); for(var i=e+1;i<N;i++) s+=j.w[i]; return s; }

function normOpts(o){ o=o||{}; return { length:o.length>0?o.length:0, motion:(o.motion==='drift'||o.motion==='jumps')?o.motion:'rewind',
  jumpFreq:clamp(o.jumpFreq==null?0.35:o.jumpFreq,0,1), rewindSize:clamp(o.rewindSize==null?0.35:o.rewindSize,0,1), driftSpeed:clamp(o.driftSpeed==null?0.4:o.driftSpeed,0,1) }; }

function createJourney(opts,seed,startEra){ var o=normOpts(opts); seed=(seed>>>0)||newSeed(); var r=rngFrom(seed);
  var j={v:1,seed:seed,r:r,universe:1,x:0,t:0,segs:0,done:false,w:weightsFor(r),pending:null,length:o.length,history:[]};
  j.pace0=o.length? o.length*(1-budget(o))/sum(j.w) : ENDLESS_UNIVERSE/sum(j.w);
  if(startEra>0){ j.x=clamp(startEra|0,0,N-1); j.pending='chosen'; }
  return j; }

function pace(j,o){ if(!o.length) return j.pace0; var rem=remainingW(j,j.x), T=o.length-j.t; if(rem<=0) return j.pace0; return Math.max(j.pace0*0.25,T/rem); }

/* Plan the next segment. opts may change between calls (the listener moves sliders). */
function nextSegment(j,opts){ var o=normOpts(opts); if(j.done) return null;
  if(o.length!==j.length){ // length changed mid-journey: keep where we are, recompute the base pace
    j.length=o.length; j.pace0=o.length? Math.max(60,(o.length-j.t))*(1-budget(o))/Math.max(0.01,remainingW(j,j.x)) : ENDLESS_UNIVERSE/sum(j.w); }
  var kind=j.pending||(j.segs===0?'start':'forward'); j.pending=null; var from=j.x;
  if(j.x>=N-1e-9){ if(o.length&&j.t>=o.length-1){ j.done=true; return null; }
    if(o.length){ j.done=true; return null; }
    j.universe++; j.x=0; j.w=weightsFor(j.r); kind='newuniverse'; }
  var finite=!!o.length;
  if(kind==='forward'&&j.segs>0&&o.motion!=='drift'){
    var jf=o.jumpFreq, rs=o.rewindSize, u=next(j.r);
    var pRew=o.motion==='rewind'?0.06+0.34*jf:0.05+0.25*jf, pJump=o.motion==='jumps'?0.04+0.26*jf:0;
    var frac=finite?j.t/o.length:0;
    var canBack=function(x2){ if(!finite) return true; if(frac>0.85) return false; var rem=remainingW(j,x2), T=o.length-j.t; return T/Math.max(rem,1e-6)>=0.55*j.pace0; };
    if(u<pJump){ var size=Math.round(lerp(2,5,rs))+(next(j.r)<0.5?0:1)-((next(j.r)<0.3)?1:0); size=Math.max(1,size);
      var back=next(j.r)<0.5, e=Math.floor(j.x);
      var xb=Math.max(0,e-size)+next(j.r)*0.3;
      if(back&&e>0&&canBack(xb)){ j.x=xb; kind='jumpback'; }
      else if(e+size<N){ j.x=e+size; kind='jumpforward'; }
      else if(e>0&&canBack(xb)){ j.x=xb; kind='jumpback'; }
    } else if(u<pJump+pRew){ var b=lerp(0.08,1.2,rs)*(0.7+0.6*next(j.r)); var xr=Math.max(0,j.x-b);
      if(xr<j.x-0.01&&canBack(xr)){ j.x=xr; kind='rewind'; } }
  } else if(kind==='forward'&&o.motion==='drift') { next(j.r); }
  var era=Math.min(N-1,Math.floor(j.x)), p=j.x-era;
  var eraLen=j.w[era]*pace(j,o);
  var segSec=lerp(300,70,o.driftSpeed)*(0.75+0.5*next(j.r));
  var df=segSec/eraLen, to=Math.min(1,p+df); if(1-to<0.25*df) to=1;
  var dur=Math.max(20,(to-p)*eraLen);
  var seg={n:j.segs,universe:j.universe,era:era,from:p,to:to,dur:dur,start:j.t,kind:kind,prev:from,variant:Math.floor(next(j.r)*2147483647)};
  j.x=era+to; j.t+=dur; j.segs++; j.cur=era;
  j.history.push([seg.era,Math.round(seg.from*100)/100,seg.kind]); if(j.history.length>60) j.history.shift();
  return seg; }

function jumpTo(j,era){ j.x=clamp(era|0,0,N-1); j.pending='chosen'; j.done=false; }
function cur(j){ return j.cur!=null?j.cur:Math.min(N-1,Math.floor(j.x)); }
function stepBack(j){ j.x=Math.max(0,cur(j)-1); j.pending='chosen'; j.done=false; }
function stepForward(j){ var e=cur(j)+1; j.x=e>=N?N:e; j.pending='chosen'; j.done=false; }

/* ---------- mixing ---------- */
var SYN_TAGS={ hiss:{confuse:1,still:-0.3}, plasma:{confuse:0.8,fear:0.3}, drone:{create:0.3,still:0.4,confuse:-0.3}, shimmer:{create:0.6,still:0.2,fear:-0.4},
  sub:{fear:0.7,still:0.5}, ignite:{create:1,still:-0.4}, bloom:{create:0.7,fear:0.4,still:-0.6}, beating:{fear:0.6,still:-0.1}, rumble:{fear:1,create:-0.3},
  grit:{confuse:0.7,still:-0.5}, pulsar:{create:0.4,still:-0.3,confuse:-0.2}, cmb:{still:0.3,confuse:-0.6} };
var SYNTHS=['hiss','plasma','drone','shimmer','sub','ignite','bloom','beating','rumble','grit','pulsar','cmb'];
function bias(m){ m=m||{}; var f=function(v){ return clamp(((v==null?50:v)-50)/50,-1,1); };
  return {fear:f(m.fear),create:f(m.create),still:f(m.still),confuse:-f(m.order)}; }
function dot(b,t){ var s=0; for(var k in t) if(b[k]!=null) s+=b[k]*t[k]; return s; }

function layerWeight(l,era,b){ var t=l.tags||{}; var w=Math.exp(2.4*dot(b,t))*(1+0.6*dot(era.colour,t)); return w; }

function mixFor(seg,moods,layers,prefs){ prefs=prefs||{}; var off=prefs.off||{}, synOff=prefs.synthOff||{};
  var r=rngFrom(seg.variant+1), era=ERAS[seg.era], b=bias(moods), n1=seg.era+1;
  var cand=(layers||[]).filter(function(l){ return l.role!=='event'&&l.eras.indexOf(n1)>=0&&!off[l.id]; });
  var rc=era.realCount, n=rc[0]+Math.floor(next(r)*(rc[1]-rc[0]+1));
  if(b.still>0.5) n--; if(b.confuse>0.5) n++; n=clamp(n,1,Math.max(1,cand.length));
  var picked=[], pool=cand.map(function(l){ return {l:l,w:layerWeight(l,era,b)}; });
  while(picked.length<n&&pool.length){ var tot=0,i; for(i=0;i<pool.length;i++) tot+=pool[i].w; var u=next(r)*tot;
    for(i=0;i<pool.length;i++){ u-=pool[i].w; if(u<=0) break; } i=Math.min(i,pool.length-1); picked.push(pool[i].l); pool.splice(i,1); }
  var LV=[1,0.75,0.6,0.5], real=picked.map(function(l,k){ var side=k===0?(next(r)-0.5)*0.6:(k%2?-1:1)*(0.5+0.4*next(r));
    return {id:l.id,gain:era.realLevel*LV[Math.min(k,3)]*(0.85+0.15*next(r)),pan:side,rate:era.pitch*(1+(next(r)-0.5)*0.04)}; });
  var events=(layers||[]).filter(function(l){ return l.role==='event'&&l.eras.indexOf(n1)>=0&&!off[l.id]; }).map(function(l){ return {id:l.id,every:Math.round(lerp(240,90,Math.max(0,b.fear))*(0.8+0.4*next(r)))}; });
  var synth={}, k;
  for(k in era.synth){ var base=era.synth[k]; if(!base) continue; var mm=clamp(Math.exp(1.2*dot(b,SYN_TAGS[k]||{})),0.15,2.5); synth[k]=base*mm*(0.8+0.4*next(r)); }
  if(b.fear>0.4&&!synth.rumble) synth.rumble=0.3*b.fear; if(b.create>0.4&&!synth.ignite) synth.ignite=0.25*b.create;
  if(b.confuse>0.4&&!synth.hiss) synth.hiss=0.25*b.confuse; if(b.still>0.4&&!synth.sub) synth.sub=0.2*b.still;
  if(b.fear>0.6&&!synth.beating) synth.beating=0.2*b.fear;
  for(k in synOff) if(synOff[k]) delete synth[k];
  var rs=0,ss=0; real.forEach(function(x){ rs+=x.gain; }); for(k in synth) ss+=synth[k];
  if(real.length&&ss>0.8*rs){ var sc=0.8*rs/ss; for(k in synth) synth[k]*=sc; }
  var cutoff=clamp(era.cutoff*Math.pow(2,0.8*b.create-0.9*b.fear-0.3*b.still),250,9000);
  var motifs=[]; era.motifs.forEach(function(m){ if(m[1]>=seg.from&&m[1]<seg.to) motifs.push({id:m[0],at:(m[1]-seg.from)/Math.max(1e-6,seg.to-seg.from)*seg.dur}); });
  return { era:seg.era, eraId:era.id, mood:era.mood, real:real, events:events, synth:synth, cutoff:cutoff,
    sweepPeriod:lerp(45,110,Math.max(0,b.still)), detune:Math.max(0,b.fear)*30, mod:clamp(1-0.6*Math.max(0,b.still)+0.4*Math.max(0,b.confuse),0.2,1.4),
    width:clamp(era.width+(era.widen?0.25*seg.to:0),0,1.3), widen:!!era.widen, pitch:era.pitch, motifs:motifs, bias:b,
    eventRate:clamp(1-0.5*b.still+0.3*b.confuse+0.2*b.create,0.3,1.6) }; }

function realShare(mix,vols){ vols=vols||{real:1,synth:1}; var r=0,s=0,k; mix.real.forEach(function(x){ r+=x.gain; }); for(k in mix.synth) s+=mix.synth[k];
  r*=vols.real; s*=vols.synth; return r+s>0?r/(r+s):0; }

function describe(seg){ if(!seg) return ''; var e=ERAS[seg.era]; var k={start:'The journey begins',forward:'Onwards',rewind:'Stepping back a little, to evolve again along a different path',jumpback:'A big jump back through time',jumpforward:'A big jump forward through time',newuniverse:'A new universe begins',chosen:'You chose'}[seg.kind]||'';
  return k+': era '+(seg.era+1)+' of '+N+', '+e.name+'.'; }

var API={ERAS:ERAS,N:N,SYNTHS:SYNTHS,createJourney:createJourney,nextSegment:nextSegment,jumpTo:jumpTo,stepBack:stepBack,stepForward:stepForward,
  mixFor:mixFor,realShare:realShare,bias:bias,describe:describe,newSeed:newSeed,_rng:{next:next,from:rngFrom},ENDLESS_UNIVERSE:ENDLESS_UNIVERSE};
if(typeof module!=='undefined'&&module.exports) module.exports=API; else root.CS_ENGINE=API;
})(this);
