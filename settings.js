/* Cosmic Sanctuary settings: defaults, validation, saving and presets (localStorage). Pure, testable in Node. */
(function(root){
'use strict';
var KEY='cs1-settings', PKEY='cs1-presets';
var DEFAULTS={ v:1, setting:'meditator',
  journey:{length:3600,motion:'rewind',jumpFreq:35,rewindSize:35,driftSpeed:40},
  moods:{order:50,fear:50,create:50,still:50},
  groups:{ real:{on:true,vol:80}, synth:{on:true,vol:55}, motifs:{on:true,vol:45}, binaural:{on:false,vol:30}, noise:{on:false,vol:25}, bowls:{on:false,vol:35} },
  space:{master:80,width:100,mono:false,swap:false,crossfeed:20,sweep:50,mod:50,smear:35,pitchDrift:30,cues:true},
  binaural:{band:'theta',carrier:200,beats:true,drift:true,iso:false,isoVol:20,solf:0,solfVol:15},
  noise:{pink:60,brown:50,white:0},
  bowls:{crystal:60,tibetan:60,every:180},
  voice:{speak:true,rate:90,voiceName:'',duck:50,announce:false,motifCalls:false},
  timer:{min:0,fade:10},
  screen:{wake:true},
  audioMode:'background',
  off:{}, synthOff:{} };
var ENUMS={ setting:['meditator','cosmologist'], 'journey.motion':['drift','rewind','jumps'], 'binaural.band':['delta','theta','alpha','beta','gamma'], audioMode:['background','playback','mix'],
  'journey.length':[1800,3600,7200,14400,0], 'binaural.solf':[0,174,285,396,417,528,639,741,852,963], 'timer.min':[0,15,30,45,60,90,120,180,240] };
var RANGES={ 'journey.jumpFreq':[0,100],'journey.rewindSize':[0,100],'journey.driftSpeed':[0,100], 'moods.*':[0,100], 'groups.*.vol':[0,100],
  'space.master':[0,100],'space.width':[0,150],'space.crossfeed':[0,100],'space.sweep':[0,100],'space.mod':[0,100],'space.smear':[0,100],'space.pitchDrift':[0,100],
  'binaural.carrier':[80,500],'binaural.isoVol':[0,100],'binaural.solfVol':[0,100],'noise.*':[0,100],'bowls.crystal':[0,100],'bowls.tibetan':[0,100],'bowls.every':[20,900],
  'voice.rate':[50,150],'voice.duck':[0,100],'timer.fade':[0,30] };
function clone(o){ return JSON.parse(JSON.stringify(o)); }
function rangeFor(path){ if(RANGES[path]) return RANGES[path]; var parts=path.split('.');
  for(var k in RANGES){ var kp=k.split('.'); if(kp.length!==parts.length) continue; var ok=true; for(var i=0;i<kp.length;i++) if(kp[i]!=='*'&&kp[i]!==parts[i]){ ok=false; break; } if(ok) return RANGES[k]; } return null; }
function sanitizeInto(def,src,path,out){
  for(var k in def){ var p=path?path+'.'+k:k, d=def[k], s=src&&typeof src==='object'?src[k]:undefined;
    if(k==='off'||k==='synthOff'){ var m={}; if(s&&typeof s==='object') for(var id in s) if(s[id]===true&&/^[a-z0-9_]{1,40}$/.test(id)) m[id]=true; out[k]=m; continue; }
    if(d&&typeof d==='object'){ out[k]={}; sanitizeInto(d,s,p,out[k]); continue; }
    if(ENUMS[p]){ out[k]=ENUMS[p].indexOf(s)>=0?s:d; continue; }
    if(typeof d==='boolean'){ out[k]=typeof s==='boolean'?s:d; continue; }
    if(typeof d==='number'){ var n=typeof s==='number'&&isFinite(s)?s:d, r=rangeFor(p); if(r) n=Math.min(r[1],Math.max(r[0],n)); out[k]=n; continue; }
    if(typeof d==='string'){ out[k]=typeof s==='string'&&s.length<120?s:d; continue; }
    out[k]=d; } return out; }
function sanitize(s){ return sanitizeInto(DEFAULTS,s||{},'',{}); }
function merge(base,over){ var o=clone(base); (function m(a,b){ for(var k in b){ if(b[k]&&typeof b[k]==='object'&&!Array.isArray(b[k])&&a[k]&&typeof a[k]==='object') m(a[k],b[k]); else a[k]=b[k]; } })(o,over||{}); return o; }
function load(storage){ try{ var raw=storage&&storage.getItem(KEY); if(raw) return sanitize(JSON.parse(raw)); }catch(e){} return clone(DEFAULTS); }
function save(storage,s){ try{ storage.setItem(KEY,JSON.stringify(sanitize(s))); return true; }catch(e){ return false; } }
// Built-in presets change the journey and the sound, never your speaker settings (master volume, mono, swap).
var BUILTIN=[
 { id:'gentle', name:'Gentle Genesis', about:'A slow, kind journey from the beginning: drift only, calm moods, soft crystal bowls and a little pink noise.',
   s:{ setting:'meditator', journey:{length:3600,motion:'drift',driftSpeed:20}, moods:{order:65,fear:20,create:60,still:75},
       groups:{real:{on:true,vol:75},synth:{on:true,vol:45},motifs:{on:true,vol:35},binaural:{on:true,vol:20},noise:{on:true,vol:18},bowls:{on:true,vol:30}},
       space:{sweep:35,mod:35,smear:50,pitchDrift:20,cues:false}, binaural:{band:'alpha'}, noise:{pink:60,brown:30,white:0}, bowls:{crystal:70,tibetan:30,every:240} } },
 { id:'fright', name:'Frightening Cosmos', about:'Dramatic jumps, black holes and dark, dissonant layers. Starts at galaxies and black holes.', startEra:8,
   s:{ setting:'meditator', journey:{length:3600,motion:'jumps',jumpFreq:60,rewindSize:60,driftSpeed:60}, moods:{order:30,fear:95,create:30,still:15},
       groups:{real:{on:true,vol:85},synth:{on:true,vol:65},motifs:{on:true,vol:45},binaural:{on:false},noise:{on:false},bowls:{on:false}},
       space:{sweep:80,mod:75,smear:45,pitchDrift:45,cues:true} } },
 { id:'creative', name:'Creative Universe', about:'Bright, blooming and rising: first stars, supernovae and planets forming. Starts at cosmic dawn.', startEra:6,
   s:{ setting:'meditator', journey:{length:3600,motion:'rewind',jumpFreq:35,rewindSize:30,driftSpeed:45}, moods:{order:60,fear:15,create:95,still:30},
       groups:{real:{on:true,vol:85},synth:{on:true,vol:55},motifs:{on:true,vol:45},binaural:{on:false},noise:{on:false},bowls:{on:true,vol:28}},
       space:{sweep:55,mod:55,smear:40,pitchDrift:30,cues:true}, bowls:{crystal:80,tibetan:20,every:200} } },
 { id:'sleep', name:'Deep Sleep in the Void', about:'Four hours of stillness with delta binaural beats and brown noise, and a 90 minute sleep timer with a 20 minute fade.',
   s:{ setting:'meditator', journey:{length:14400,motion:'drift',driftSpeed:10}, moods:{order:70,fear:20,create:30,still:95},
       groups:{real:{on:true,vol:70},synth:{on:true,vol:45},motifs:{on:true,vol:20},binaural:{on:true,vol:25},noise:{on:true,vol:30},bowls:{on:true,vol:18}},
       space:{sweep:25,mod:25,smear:55,pitchDrift:15,cues:false}, binaural:{band:'delta'}, noise:{pink:20,brown:70,white:0}, bowls:{crystal:40,tibetan:60,every:420},
       timer:{min:90,fade:20}, voice:{announce:false} } },
 { id:'tour', name:'Cosmologist\'s Tour', about:'An hour from the beginning to the far future, drifting forwards, with a spoken explanation at every era.',
   s:{ setting:'cosmologist', journey:{length:3600,motion:'drift',driftSpeed:40}, moods:{order:50,fear:50,create:50,still:50},
       groups:{real:{on:true,vol:80},synth:{on:true,vol:50},motifs:{on:true,vol:60},binaural:{on:false},noise:{on:false},bowls:{on:false}},
       space:{cues:true}, voice:{speak:true,announce:true} } }
];
function applyPreset(cur,p){ var keep={master:cur.space.master,mono:cur.space.mono,swap:cur.space.swap,width:cur.space.width,crossfeed:cur.space.crossfeed};
  var o=sanitize(merge(cur,p.s)); o.space.master=keep.master; o.space.mono=keep.mono; o.space.swap=keep.swap; o.space.width=keep.width; o.space.crossfeed=keep.crossfeed; return o; }
function listUserPresets(storage){ try{ var o=JSON.parse(storage.getItem(PKEY)||'{}'); return o&&typeof o==='object'?o:{}; }catch(e){ return {}; } }
function saveUserPreset(storage,name,s){ name=String(name||'').trim().slice(0,60); if(!name) return false; var all=listUserPresets(storage); all[name]={savedAt:Date.now(),s:sanitize(s)};
  try{ storage.setItem(PKEY,JSON.stringify(all)); return true; }catch(e){ return false; } }
function loadUserPreset(storage,name){ var p=listUserPresets(storage)[name]; return p?sanitize(p.s):null; }
function deleteUserPreset(storage,name){ var all=listUserPresets(storage); if(!(name in all)) return false; delete all[name]; storage.setItem(PKEY,JSON.stringify(all)); return true; }
var API={KEY:KEY,PKEY:PKEY,DEFAULTS:DEFAULTS,ENUMS:ENUMS,sanitize:sanitize,merge:merge,load:load,save:save,BUILTIN:BUILTIN,applyPreset:applyPreset,
  listUserPresets:listUserPresets,saveUserPreset:saveUserPreset,loadUserPreset:loadUserPreset,deleteUserPreset:deleteUserPreset,clone:clone};
if(typeof module!=='undefined'&&module.exports) module.exports=API; else root.CS_SETTINGS=API;
})(this);
