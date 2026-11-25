/* Cosmic Sanctuary: the page, controls, journey loop, speech, sleep timer, presets, interruptions and offline saving. */
(function(){
'use strict';
var E=window.CS_ENGINE, ST=window.CS_SETTINGS, A=window.CS_AUDIO, ER=window.CS_ERAS;
var $=function(id){ return document.getElementById(id); };
var BASES=window.CS_BASES||{}; var SESS='cs1-session', UI='cs1-ui';
var S=ST.load(localStorage), MAN=null, LAY={}, BOWLS=[], ctx=null, C=null, J=null, seg=null, segEnd=0, segStartCtx=0, playing=false, loopT=null;
var UNDER=null, underG=null; /* v2: soundscape playing quietly under the Cosmologist Library */
var pausedAt=null, pendingStart=0, motifQ=[], unlockEl=null, msd=null, wake=null, timerEnd=0, lastSave=0, interrupted=false, notRunningSince=0, lastEra=-1;
function say(m){ var s=$('status'); s.textContent=''; setTimeout(function(){ s.textContent=m; },60); }
function pct(v){ return Math.round(v)+' percent'; }
function minsWords(m){ m=Math.round(m); if(m<60) return m+(m===1?' minute':' minutes'); var h=Math.floor(m/60), r=m%60; return h+(h===1?' hour':' hours')+(r?' '+r+' minutes':''); }
function lenWords(s){ return s?minsWords(s/60):'endless'; }
function el(tag,attrs,kids){ var e=document.createElement(tag); if(attrs) for(var k in attrs){ if(k==='text') e.textContent=attrs[k]; else if(k==='on') for(var ev in attrs.on) e.addEventListener(ev,attrs.on[ev]); else if(attrs[k]!=null) e.setAttribute(k,attrs[k]); }
  (kids||[]).forEach(function(c){ if(c) e.appendChild(typeof c==='string'?document.createTextNode(c):c); }); return e; }
function getP(path){ return path.split('.').reduce(function(o,k){ return o==null?undefined:o[k]; },S); }
function setP(path,v){ var ks=path.split('.'), o=S; for(var i=0;i<ks.length-1;i++) o=o[ks[i]]; o[ks[ks.length-1]]=v; }
var saveT=0; function changed(what){ S=ST.sanitize(S); clearTimeout(saveT); saveT=setTimeout(function(){ ST.save(localStorage,S); },300); if(C) C.setParams(S); if(C&&C.setSolfeggio) C.setSolfeggio(S.binaural.solf,S.binaural.solfVol);
  if(what==='mix'&&playing&&seg) remix(6); if(what==='live') liveMode(); if(what==='wake') wakeLock(); if(what==='timer') setTimer(); }
var uid=0, refreshers=[];
function slider(path,label,min,max,step,fmt,what,hint){ var id='c'+(++uid), inp=el('input',{type:'range',id:id,min:min,max:max,step:step||1}); inp.value=getP(path);
  var upd=function(){ inp.setAttribute('aria-valuetext',fmt(+inp.value)); }; upd();
  inp.addEventListener('input',function(){ setP(path,+inp.value); upd(); changed(what); });
  refreshers.push(function(){ inp.value=getP(path); upd(); });
  return el('div',{class:'field'},[el('label',{for:id,text:label}),inp,hint?el('p',{class:'hint',text:hint}):null]); }
function toggle(path,label,what,hint){ var id='c'+(++uid), inp=el('input',{type:'checkbox',id:id}); inp.checked=!!getP(path);
  inp.addEventListener('change',function(){ setP(path,inp.checked); changed(what); }); refreshers.push(function(){ inp.checked=!!getP(path); });
  return el('div',{},[el('div',{class:'check'},[inp,el('label',{for:id,text:label})]),hint?el('p',{class:'hint',text:hint}):null]); }
function radios(path,legend,opts,what){ var name='r'+(++uid), fs=el('fieldset',{},[el('legend',{text:legend})]), inputs=[];
  opts.forEach(function(o){ var id='c'+(++uid), inp=el('input',{type:'radio',name:name,id:id}); inp.checked=getP(path)===o[0]; inputs.push([inp,o[0]]);
    inp.addEventListener('change',function(){ if(inp.checked){ setP(path,o[0]); changed(what); } }); fs.appendChild(el('div',{class:'radio'},[inp,el('label',{for:id,text:o[1]})])); });
  refreshers.push(function(){ inputs.forEach(function(x){ x[0].checked=getP(path)===x[1]; }); }); return fs; }
function button(label,fn,attrs){ var b=el('button',Object.assign({type:'button',text:label},attrs||{})); b.addEventListener('click',fn); return b; }
function refreshAll(){ refreshers.forEach(function(f){ try{ f(); }catch(e){} }); }
var uiState={}; try{ uiState=JSON.parse(localStorage.getItem(UI)||'{}'); }catch(e){}
function section(key,title,open,kids){ var bid='s'+key, body=el('div',{class:'secbody',id:bid+'b'},kids); var isOpen=uiState[key]!=null?uiState[key]:open;
  var hb=el('button',{type:'button',class:'sechead','aria-expanded':String(isOpen),'aria-controls':bid+'b',text:title}); body.hidden=!isOpen;
  hb.addEventListener('click',function(){ var o=hb.getAttribute('aria-expanded')!=='true'; hb.setAttribute('aria-expanded',String(o)); body.hidden=!o; uiState[key]=o; try{ localStorage.setItem(UI,JSON.stringify(uiState)); }catch(e){} });
  return el('section',{class:'sec'},[el('h2',{},[hb]),body]); }

/* ---------- words for slider values ---------- */
var W={ pct:pct, vol:function(v){ return v?pct(v):'silent'; },
  order:function(v){ return v<45?'towards confusion, '+Math.round((50-v)*2)+' percent':v>55?'towards order, '+Math.round((v-50)*2)+' percent':'balanced'; },
  mood:function(name){ return function(v){ return v<45?'less '+name+', '+pct(v):v>55?'more '+name+', '+pct(v):'neutral, '+pct(v); }; },
  width:function(v){ return v===0?'mono':v<100?pct(v)+', narrower than normal':v===100?'normal width':pct(v)+', extra wide'; },
  hz:function(v){ return v+' hertz'; }, freq:function(v){ return v<30?'rarely':v<60?'sometimes':v<85?'often':'very often'; },
  size:function(v){ return v<30?'small steps back':v<65?'medium steps back':'big steps back'; },
  speed:function(v){ return v<25?'very slow':v<50?'slow':v<75?'medium':'fast'; },
  every:function(v){ return 'about every '+(v<90?Math.round(v)+' seconds':minsWords(v/60)); },
  rate:function(v){ return (v/100).toFixed(2)+' times normal speed'; }, fade:function(v){ return v?minsWords(v)+' fade':'no fade'; } };

/* ---------- build the page ---------- */
function build(){ var app=$('app'); app.innerHTML='';
  var top=el('div',{},[ radios('setting','Setting',[['meditator','Meditator: sound only, no voice'],['cosmologist','Cosmologist: a spoken explanation at each era']],'live') ]);
  app.appendChild(top);
  var eraList=el('ol',{class:'eras'}); E.ERAS.forEach(function(e,i){ eraList.appendChild(el('li',{},[button(e.name+': '+e.short,function(){ jumpEra(i); })])); });
  app.appendChild(section('eras','Jump to an era',true,[el('p',{class:'hint',text:'Choose an era and the journey carries on from there.'}),eraList]));
  app.appendChild(section('journey','Journey',true,[
    radios('journey.length','Journey length',[[1800,'30 minutes'],[3600,'1 hour'],[7200,'2 hours'],[14400,'4 hours'],[0,'Endless: a new universe begins after each one']],'journey'),
    radios('journey.motion','How the journey moves',[['drift','Drift only: always forwards, gently'],['rewind','Drift with small rewinds: sometimes steps back and evolves a different way'],['jumps','Dramatic jumps: also leaps back and forward through whole eras']],'journey'),
    slider('journey.jumpFreq','How often it rewinds or jumps',0,100,1,W.freq,'journey'),
    slider('journey.rewindSize','Rewind size',0,100,1,W.size,'journey'),
    slider('journey.driftSpeed','Drift speed: how fast sounds move and change',0,100,1,W.speed,'mix'),
    toggle('space.cues','Play a whoosh when the journey rewinds or jumps'),
    el('div',{class:'row'},[button('Start again from the beginning',function(){ newJourney(false,0); }),button('Start a new universe with a new random path',function(){ newJourney(true,0); })]) ]));
  app.appendChild(section('moods','Moods',true,[ el('p',{class:'hint',text:'These steer which sounds are chosen and how they move. All in the middle is neutral.'}),
    slider('moods.order','Confusion to order',0,100,1,W.order,'mix'), slider('moods.fear','Frightening universe: darker, violent, low and dissonant',0,100,1,W.mood('frightening'),'mix'),
    slider('moods.create','Creative power: bright, blooming and rising',0,100,1,W.mood('creative'),'mix'), slider('moods.still','Stillness',0,100,1,W.mood('still'),'mix') ]));
  var G=[['real','Real space recordings and NASA sonifications'],['synth','Synthesised cosmos'],['motifs','Teaching motifs'],['binaural','Brainwave tones: binaural beats, isochronic pulses and solfeggio'],['noise','Noise: pink, brown and white'],['bowls','Singing bowls: crystal and Tibetan']];
  app.appendChild(section('layers','Sound layers',true,G.map(function(g){ return el('div',{class:'box'},[el('h3',{text:g[1]}),toggle('groups.'+g[0]+'.on',g[1]+' on','groups'),slider('groups.'+g[0]+'.vol',g[1]+' volume',0,100,1,W.vol,'groups')]); })));
  app.appendChild(section('space','Speakers, space and movement',false,[ slider('space.master','Master volume',0,100,1,W.vol),
    toggle('space.mono','Mono: for one speaker or the bedroom'), toggle('space.swap','Swap left and right'),
    slider('space.width','Stereo width',0,150,5,W.width), slider('space.crossfeed','Crossfeed: blends a little of each side into the other, for earphones',0,100,1,W.pct),
    slider('space.sweep','Filter sweep depth: slow brightening and darkening',0,100,1,W.pct), slider('space.mod','Modulation depth: how much sounds pan, flicker and move',0,100,1,W.pct),
    slider('space.smear','Space: how much the sounds smear into a vast echo',0,100,1,W.pct), slider('space.pitchDrift','Pitch drift of the recordings',0,100,1,W.pct) ]));
  app.appendChild(section('brain','Brainwave tones',false,[ el('p',{class:'hint',text:'Binaural beats need stereo, so they work best on earphones or with a speaker either side. In mono they become a gentle pulsing instead. Turn the Brainwave tones layer on under Sound layers.'}),
    radios('binaural.band','Brainwave band',[['delta','Delta, about 2 beats a second: deep sleep'],['theta','Theta, about 6: deep relaxation and dreaming'],['alpha','Alpha, about 10: calm, awake'],['beta','Beta, about 16: alert'],['gamma','Gamma, about 40: focus']],'brain'),
    slider('binaural.carrier','Carrier tone',80,500,5,W.hz), toggle('binaural.beats','Binaural beats on'), toggle('binaural.drift','Let the beat drift slowly within the band'),
    toggle('binaural.iso','Isochronic pulses on (off by default)'), slider('binaural.isoVol','Isochronic pulse volume',0,100,1,W.vol),
    (function(){ var id='c'+(++uid), s=el('select',{id:id}); ST.ENUMS['binaural.solf'].forEach(function(f){ var o=el('option',{value:f,text:f?f+' hertz':'Off'}); s.appendChild(o); }); s.value=S.binaural.solf;
      s.addEventListener('change',function(){ S.binaural.solf=+s.value; changed(); }); refreshers.push(function(){ s.value=S.binaural.solf; }); return el('div',{class:'field'},[el('label',{for:id,text:'Solfeggio tone'}),s]); })(),
    slider('binaural.solfVol','Solfeggio tone volume',0,100,1,W.vol) ]));
  app.appendChild(section('noise','Noise',false,[ slider('noise.pink','Pink noise',0,100,1,W.vol), slider('noise.brown','Brown noise',0,100,1,W.vol), slider('noise.white','White noise',0,100,1,W.vol) ]));
  app.appendChild(section('bowls','Singing bowls',false,[ slider('bowls.crystal','Crystal bowls',0,100,1,W.vol), slider('bowls.tibetan','Tibetan bowls',0,100,1,W.vol), slider('bowls.every','How often a bowl sounds',20,900,10,W.every),
    el('div',{class:'row'},[button('Strike a crystal bowl now',function(){ ensure(); C.bowlList=BOWLS; if(!S.groups.bowls.on) say('Singing bowls are off under Sound layers; turn them on to hear them.'); C.bowlNow('crystal'); }),button('Strike a Tibetan bowl now',function(){ ensure(); C.bowlList=BOWLS; if(!S.groups.bowls.on) say('Singing bowls are off under Sound layers; turn them on to hear them.'); C.bowlNow('tibetan'); })]) ]));
  app.appendChild(section('cosmo','Cosmologist voice',false,[ toggle('voice.speak','Speak an explanation at each new era, in the Cosmologist setting'), toggle('voice.announce','Announce each new era name to VoiceOver','live','Off by default in the Meditator setting. Uses a polite announcement.'),
    slider('voice.rate','Speaking speed',50,150,5,W.rate), slider('voice.duck','How much the sound dips while speaking',0,100,5,W.pct), voiceSelect(),
    el('div',{class:'row'},[button('Read this era aloud',function(){ var e=seg?seg.era:0; speak(ER.TEXT[E.ERAS[e].id]); }),button('Stop speaking',stopSpeaking)]) ]));
  app.appendChild(section('notes','This era: notes',false,[el('div',{id:'notes',class:'note'})]));
  app.appendChild(section('library','Cosmic library',false,library()));
  app.appendChild(section('indiv','Individual sounds',false,individual()));
  app.appendChild(section('timer','Sleep timer',false,[ radios('timer.min','Sleep timer',ST.ENUMS['timer.min'].map(function(m){ return [m,m?minsWords(m):'Off']; }),'timer'), slider('timer.fade','Fade out over the last',0,30,1,W.fade,'timer'), el('p',{id:'timerLeft',text:'The sleep timer is off.'}) ]));
  app.appendChild(section('presets','Presets',false,presets()));
  app.appendChild(section('device','Screen, offline and audio',false,[ toggle('screen.wake','Keep the screen awake while playing','wake'),
    radios('audioMode','How the sound plays on iPhone',[['background','Background: keeps playing with the screen locked (best)'],['playback','Playback: normal, ignores the silent switch'],['mix','Mix with other apps']],'audio'),
    el('div',{class:'row'},[button('Save all sounds for offline use',saveOffline),button('Check offline status',checkOffline)]), el('p',{id:'offlineInfo',text:''}) ]));
  app.appendChild(section('help','Help and credits',false,[ el('p',{text:'Press Play to begin. The journey moves through thirteen eras of the universe. Most of what you hear are real recordings and NASA data sonifications; the rest is synthesised in your phone to carry ideas. Everything is adjustable, and your settings are remembered.'}),
    el('p',{text:'If the sound stops after a phone call, press Resume. If a journey was interrupted, you can carry it on from where it was.'}),
    el('p',{},[el('a',{href:'credits.html',text:'Credits and licences for every recording'})]) ]));
  renderNotes(seg?seg.era:0); }
function voiceSelect(){ var id='c'+(++uid), s=el('select',{id:id}); var fill=function(){ var vs=(window.speechSynthesis&&speechSynthesis.getVoices())||[]; s.innerHTML=''; s.appendChild(el('option',{value:'',text:'Automatic British voice'}));
    vs.filter(function(v){ return /^en/i.test(v.lang); }).forEach(function(v){ s.appendChild(el('option',{value:v.name,text:v.name+' ('+v.lang+')'})); }); s.value=S.voice.voiceName; };
  fill(); if(window.speechSynthesis) speechSynthesis.onvoiceschanged=fill; s.addEventListener('change',function(){ S.voice.voiceName=s.value; changed(); });
  return el('div',{class:'field'},[el('label',{for:id,text:'Voice'}),s]); }
function library(){ var out=[el('p',{class:'hint',text:'Every explanation, to read or hear at any time. Read uses the app voice; Show text puts the words on the page for VoiceOver.'})];
  function item(title,paras,extra){ var body=el('div',{class:'note',hidden:''}); paras.forEach(function(p){ body.appendChild(el('p',{text:p})); });
    var show=button('Show text: '+title,function(){ body.hidden=!body.hidden; show.setAttribute('aria-expanded',String(!body.hidden)); }); show.setAttribute('aria-expanded','false');
    return el('div',{class:'box'},[el('h4',{text:title,style:'margin:.4rem 0;font-size:1.05rem'}),el('div',{class:'row'},[button('Read: '+title,function(){ speak(paras); }),show].concat(extra||[])),body]); }
  out.push(el('h3',{text:'The thirteen eras'})); E.ERAS.forEach(function(e,i){ out.push(item('Era '+(i+1)+': '+e.name,ER.TEXT[e.id])); });
  out.push(el('h3',{text:'Big questions'})); ER.LIBRARY.forEach(function(x){ out.push(item(x.title,x.text)); });
  out.push(el('h3',{text:'Sound motifs: patterns that teach'})); ER.MOTIFS.forEach(function(m){ out.push(item(m.name,[m.text],[button('Hear: '+m.name,function(){ ensure(); var d=C.motif(m.id,true); say('Playing the motif '+m.name+', about '+Math.round(d)+' seconds.'); })])); });
  return out; }
function individual(){ var out=[el('p',{class:'hint',text:'Untick anything you do not want in the journey. Hear plays a recording on its own.'}),el('h3',{text:'Real recordings'})], ul=el('ul',{class:'plain'});
  (MAN?MAN.layers:[]).forEach(function(l){ var id='c'+(++uid), inp=el('input',{type:'checkbox',id:id}); inp.checked=!S.off[l.id];
    inp.addEventListener('change',function(){ if(inp.checked) delete S.off[l.id]; else S.off[l.id]=true; changed('mix'); }); refreshers.push(function(){ inp.checked=!S.off[l.id]; });
    ul.appendChild(el('li',{},[el('div',{class:'check'},[inp,el('label',{for:id,text:l.name+' (eras '+l.eras.join(', ')+')'})]),el('p',{class:'hint',text:l.about}),el('div',{class:'row'},[button('Hear: '+l.name,function(){ preview(l); }),button('Stop',function(){ if(C) C.stopPreview(); })])])); });
  out.push(ul); out.push(el('h3',{text:'Synthesised layers'})); var ul2=el('ul',{class:'plain'});
  var SD={hiss:'Primordial hiss: noise with no pitch, flickering',plasma:'Plasma roar: a deep resonant roar',drone:'Expanding drones: slow low chords that stretch downwards',shimmer:'First light shimmer: high glassy tones',sub:'Dark-ages sub-bass',ignite:'First-star ignition swells',bloom:'Supernova blooms',beating:'Galaxy-merger slow beating',rumble:'Black-hole low rumble',grit:'Planet-forming granular grit',pulsar:'Pulsar clicks at real spin rates',cmb:'The cosmic microwave background chord'};
  E.SYNTHS.forEach(function(k){ var id='c'+(++uid), inp=el('input',{type:'checkbox',id:id}); inp.checked=!S.synthOff[k];
    inp.addEventListener('change',function(){ if(inp.checked) delete S.synthOff[k]; else S.synthOff[k]=true; changed('mix'); }); refreshers.push(function(){ inp.checked=!S.synthOff[k]; });
    ul2.appendChild(el('li',{},[el('div',{class:'check'},[inp,el('label',{for:id,text:SD[k]||k})])])); });
  out.push(ul2); return out; }
function presets(){ var out=[el('h3',{text:'Built-in presets'})], ul=el('ul',{class:'plain'});
  ST.BUILTIN.forEach(function(p){ ul.appendChild(el('li',{},[el('p',{style:'margin:.2rem 0'},[el('strong',{text:p.name}),' ',p.about]),button('Use '+p.name,function(){ usePreset(p); })])); });
  out.push(ul); out.push(el('h3',{text:'Your presets'})); var id='c'+(++uid), name=el('input',{type:'text',id:id,autocomplete:'off'});
  out.push(el('div',{class:'field'},[el('label',{for:id,text:'Name for the current settings'}),name])); out.push(button('Save current settings as a preset',function(){ if(ST.saveUserPreset(localStorage,name.value,S)){ say('Saved the preset '+name.value.trim()+'.'); name.value=''; renderUserPresets(); } else say('Type a name first.'); }));
  out.push(el('ul',{class:'plain',id:'userPresets'})); setTimeout(renderUserPresets,0); return out; }
function renderUserPresets(){ var ul=$('userPresets'); if(!ul) return; ul.innerHTML=''; var all=ST.listUserPresets(localStorage), names=Object.keys(all).sort();
  if(!names.length) ul.appendChild(el('li',{text:'No saved presets yet.'}));
  names.forEach(function(n){ ul.appendChild(el('li',{},[el('span',{text:n+' '}),button('Load '+n,function(){ var s=ST.loadUserPreset(localStorage,n); if(s){ S=s; ST.save(localStorage,S); refreshAll(); changed('mix'); liveMode(); say('Loaded your preset '+n+'.'); } }),' ',button('Delete '+n,function(){ ST.deleteUserPreset(localStorage,n); renderUserPresets(); say('Deleted '+n+'.'); })])); }); }
function usePreset(p){ S=ST.applyPreset(S,p); ST.save(localStorage,S); refreshAll(); liveMode(); if(C) C.setParams(S); setTimer();
  if(playing){ if(p.startEra!=null){ jumpEra(p.startEra,true); } else remix(5); } else pendingStart=p.startEra||0;
  say('Using '+p.name+'. '+(playing?'':'Press Play to begin.')); }
function renderNotes(e){ var n=$('notes'); if(!n) return; n.innerHTML=''; var era=E.ERAS[e]; n.appendChild(el('h3',{text:'Era '+(e+1)+' of '+E.N+': '+era.name}));
  ER.TEXT[era.id].forEach(function(p){ n.appendChild(el('p',{text:p})); }); }

/* ---------- sounds: lazy loading with a small decoded-buffer cache ---------- */
var RAW={}, RAWP={}, DEC={}, DECP={}, decOrder=[], MAXDEC=14;
function urlFor(id){ var l=LAY[id]||BOWLS.filter(function(b){ return b.id===id; })[0]; if(!l) return null; return (BASES[l.pack]||('sounds/'+l.pack+'/'))+l.file.f; }
function fetchRaw(id){ var u=urlFor(id); if(!u) return Promise.reject(new Error('no sound '+id)); if(RAW[id]) return Promise.resolve(RAW[id]); if(RAWP[id]) return RAWP[id];
  return RAWP[id]=(async function(){ var err; for(var a=0;a<3;a++){ try{ var r=await fetch(u,{mode:'cors'}); if(!r.ok) throw new Error('HTTP '+r.status); var b=await r.arrayBuffer(); RAW[id]=b; delete RAWP[id]; return b; }catch(e){ err=e; await new Promise(function(r){ setTimeout(r,1200*(a+1)); }); } } delete RAWP[id]; throw err; })(); }
function decode(ab){ return new Promise(function(res,rej){ var p=ctx.decodeAudioData(ab.slice(0),res,rej); if(p&&p.then) p.then(res,rej); }); }
function getBuffer(id){ if(DEC[id]){ touch(id); return Promise.resolve(DEC[id]); } if(DECP[id]) return DECP[id];
  return DECP[id]=fetchRaw(id).then(decode).then(function(b){ DEC[id]=b; delete DECP[id]; touch(id); evict(); return b; }).catch(function(e){ delete DECP[id]; console.warn('sound failed',id,e&&e.message); return null; }); }
function touch(id){ var i=decOrder.indexOf(id); if(i>=0) decOrder.splice(i,1); decOrder.push(id); }
function evict(){ var keep={}; if(C) for(var k in C.real) keep[k]=1; while(decOrder.length>MAXDEC){ var victim=null; for(var i=0;i<decOrder.length;i++) if(!keep[decOrder[i]]){ victim=decOrder[i]; break; } if(!victim) break; decOrder.splice(decOrder.indexOf(victim),1); delete DEC[victim]; } }
function preloadEra(e){ if(!MAN||!S.groups.real.on) return; var ids=MAN.layers.filter(function(l){ return l.eras.indexOf(e+1)>=0&&!S.off[l.id]; }).map(function(l){ return l.id; });
  (async function(){ for(var i=0;i<ids.length;i++){ try{ await fetchRaw(ids[i]); }catch(x){} } })(); }
function preview(l){ ensure(); say('Playing '+l.name+'.'); C.oneShot(l.id,0.9,0,1,true).catch(function(){ say('That sound could not be loaded. Check the internet connection.'); }); }

/* ---------- audio context, output routes and the journey loop ---------- */
function silentWav(){ var n=4410, b=new ArrayBuffer(44+n*2), v=new DataView(b), w=function(o,s){ for(var i=0;i<s.length;i++) v.setUint8(o+i,s.charCodeAt(i)); };
  w(0,'RIFF'); v.setUint32(4,36+n*2,true); w(8,'WAVE'); w(12,'fmt '); v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,1,true); v.setUint32(24,44100,true); v.setUint32(28,88200,true); v.setUint16(32,2,true); v.setUint16(34,16,true); w(36,'data'); v.setUint32(40,n*2,true);
  return URL.createObjectURL(new Blob([b],{type:'audio/wav'})); }
function setAudioSession(){ try{ if(navigator.audioSession) navigator.audioSession.type=S.audioMode==='mix'?'ambient':'playback'; }catch(e){} }
function ensure(){ setAudioSession();
  if(!ctx){ var AC=window.AudioContext||window.webkitAudioContext; ctx=new AC({latencyHint:'playback'}); try{ ctx.addEventListener('statechange',onCtxState); }catch(e){} }
  if(S.audioMode!=='mix'){ if(!unlockEl){ unlockEl=new Audio(silentWav()); unlockEl.loop=true; unlockEl.setAttribute('playsinline',''); } unlockEl.play().catch(function(){}); } else if(unlockEl) unlockEl.pause();
  if(ctx.state!=='running') ctx.resume().catch(function(){});
  if(!C){ C=new A.Cosmos(ctx,getBuffer); C.bowlList=BOWLS; C.setParams(S); C.setSolfeggio(S.binaural.solf,S.binaural.solfVol); routeOutput(); }
  return ctx; }
async function routeOutput(){ var out=$('liveOut'); try{ C.out.disconnect(); }catch(e){} if(!underG){ underG=ctx.createGain(); underG.gain.value=UNDER?UNDER.vol:1; } try{ underG.disconnect(); }catch(e){} C.out.connect(underG);
  if(S.audioMode==='background'&&ctx.createMediaStreamDestination&&!window.__noStream){ try{ if(!msd) msd=ctx.createMediaStreamDestination(); underG.connect(msd); if(out.srcObject!==msd.stream) out.srcObject=msd.stream; await out.play(); if(unlockEl) unlockEl.pause(); return; }catch(e){ try{ underG.disconnect(); }catch(_){} } }
  try{ out.pause(); }catch(e){} underG.connect(ctx.destination); }
function journeyOpts(){ var j=S.journey; if(UNDER) return {length:0,motion:'drift',jumpFreq:0,rewindSize:0,driftSpeed:0}; return {length:j.length,motion:j.motion,jumpFreq:j.jumpFreq/100,rewindSize:j.rewindSize/100,driftSpeed:j.driftSpeed/100}; }
function prefs(){ return {off:S.off,synthOff:S.synthOff}; }
function fadeFor(kind){ var d=S.journey.driftSpeed/100; return kind==='forward'||kind==='start'?28-20*d:kind==='rewind'?6:kind==='newuniverse'?9:4; }
function applySeg(s,elapsed){ seg=s; elapsed=elapsed||0; var mix=E.mixFor(s,S.moods,MAN?MAN.layers:[],prefs());
  C.applyMix(mix,elapsed?3:fadeFor(s.kind),S.groups.real.on);
  if(!elapsed&&!UNDER&&(s.kind==='rewind'||s.kind==='jumpback'||s.kind==='jumpforward'||s.kind==='newuniverse')) C.cue(s.kind);
  segStartCtx=ctx.currentTime-elapsed; segEnd=segStartCtx+s.dur; motifQ=mix.motifs.filter(function(m){ return m.at>=elapsed; }).map(function(m){ return {id:m.id,t:segStartCtx+m.at}; });
  if(s.era!==lastEra||s.kind!=='forward'){ eraChanged(s); } lastEra=s.era;
  preloadEra(Math.min(E.N-1,s.era+1)); renderNow(); }
function remix(fade){ if(!seg||!C) return; var mix=E.mixFor(seg,S.moods,MAN?MAN.layers:[],prefs()); C.applyMix(mix,fade,S.groups.real.on); }
function eraChanged(s){ var e=E.ERAS[s.era]; renderNotes(s.era); var line=E.describe(s); $('eraLive').textContent=line+' '+e.short+'.';
  if(!UNDER&&S.setting==='cosmologist'&&S.voice.speak&&(s.era!==lastEra||s.kind!=='forward')) speak(ER.TEXT[e.id]);
  if(!UNDER) mediaSession(true); }
function nextSeg(){ var s=E.nextSegment(J,journeyOpts()); if(!s){ finish(); return; } applySeg(s,0); }
function newJourney(fresh,startEra){ pausedAt=null; J=E.createJourney(journeyOpts(),fresh?E.newSeed():(J&&!fresh?J.seed:E.newSeed()),startEra||0); lastEra=-1;
  if(playing) nextSeg(); else play(); if(fresh) say('A new universe, with a new random path.'); }
function play(R){ ensure(); if(playing) return; if(!UNDER&&window.CS_LIBRARY&&window.CS_LIBRARY.isPlaying()) window.CS_LIBRARY.pause('The library is paused while the soundscape plays.'); playing=true;
  if(R){ J=R.journey; lastEra=-1; applySeg(R.seg,R.elapsed||0); setTimer(R.timerLeft); }
  else if(pausedAt&&J&&!J.done&&!pendingStart){ lastEra=-1; applySeg(pausedAt.seg,pausedAt.elapsed); setTimer(); }
  else { if(!J||J.done) J=E.createJourney(journeyOpts(),E.newSeed(),pendingStart); else if(pendingStart){ E.jumpTo(J,pendingStart); } pendingStart=0; lastEra=-1; nextSeg(); setTimer(); }
  pausedAt=null;
  clearInterval(loopT); loopT=setInterval(loop,500); renderPlay(); wakeLock(); if(!UNDER) mediaSession(true); hideResume(); $('resumeLast').hidden=true;
  if(!R) say('Playing. '+E.describe(seg)); else say('Carrying on where you left off. '+E.describe(seg)); }
function pause(msg){ if(!playing) return; if(seg) pausedAt={seg:seg,elapsed:Math.min(seg.dur-5,Math.max(0,ctx.currentTime-segStartCtx))}; playing=false; saveSession(); clearInterval(loopT); loopT=null; C.stopAll(2.5); motifQ=[]; stopSpeaking(); timerEnd=0; renderTimerLeft(); renderPlay(); if(!UNDER) releaseWake(); if(!UNDER) mediaSession(false); say(msg||'Paused. Press Play to carry on the same journey.'); }
function finish(){ say('The journey has reached the far future and come to an end. Press Play for a new universe.'); J.done=true; pause('The journey has reached the far future and come to an end. Press Play for a new universe.'); clearSession(); }
function jumpEra(i,quiet){ pausedAt=null; if(!J) J=E.createJourney(journeyOpts(),E.newSeed(),i); else E.jumpTo(J,i); if(playing){ nextSeg(); if(!quiet) say('Jumping to era '+(i+1)+': '+E.ERAS[i].name+'.'); } else { pendingStart=0; play(); } }
function loop(){ if(!playing) return;
  if(ctx.state!=='running'){ if(ctx.state!=='closed') ctx.resume().catch(function(){}); if(!interrupted){ interrupted=true; notRunningSince=Date.now(); saveSession(); } if(!document.hidden&&Date.now()-notRunningSince>4000) showResume(); return; }
  if(interrupted) onCtxState();
  C.tick(); var t=ctx.currentTime;
  while(motifQ.length&&motifQ[0].t<=t){ var m=motifQ.shift(); if(S.groups.motifs.on&&!UNDER) C.motif(m.id,false); }
  if(t>=segEnd) nextSeg();
  if(Date.now()-lastSave>5000) saveSession();
  if(timerEnd&&t>=timerEnd){ pause('The sleep timer has finished. Goodnight.'); return; }
  if(Math.floor(t)%15===0) { renderNow(); renderTimerLeft(); } }
function renderPlay(){ var b=$('playBtn'); b.textContent=playing?'Pause':'Play'; }
function renderNow(){ if(!seg){ $('now').textContent='Not playing yet.'; return; } var e=E.ERAS[seg.era], el2=J?J.t-seg.dur+(ctx?Math.max(0,ctx.currentTime-segStartCtx):0):0;
  $('now').textContent='Now: era '+(seg.era+1)+' of '+E.N+', '+e.name+'. Universe '+seg.universe+'. '+(S.journey.length?minsWords(el2/60)+' of '+lenWords(S.journey.length)+'.':minsWords(el2/60)+' into an endless journey.'); }
function whatPlaying(){ if(!playing||!C||!C.mix){ say('Nothing is playing. '+(seg?'Last era: '+E.ERAS[seg.era].name+'.':'')); return; } var m=C.mix;
  var real=m.real.map(function(r){ return LAY[r.id]?LAY[r.id].name:r.id; }); var syn=Object.keys(m.synth);
  say('Era '+(m.era+1)+', '+E.ERAS[m.era].name+'. Real sounds: '+(S.groups.real.on&&real.length?real.join('; '):'none')+'. Synthesised: '+(S.groups.synth.on&&syn.length?syn.join(', '):'none')+'.'); }

/* ---------- speech ---------- */
var speaking=false;
function pickVoice(){ var vs=speechSynthesis.getVoices()||[]; if(S.voice.voiceName){ var v=vs.filter(function(x){ return x.name===S.voice.voiceName; })[0]; if(v) return v; }
  var gb=vs.filter(function(x){ return /en[-_]GB/i.test(x.lang); }); var pref=['Daniel','Serena','Kate','Arthur','Martha','Oliver','Stephanie','Google UK English Female','Google UK English Male'];
  for(var i=0;i<pref.length;i++){ var f=gb.filter(function(x){ return x.name.indexOf(pref[i])>=0; })[0]; if(f) return f; } return gb[0]||null; }
function chunks(paras){ var out=[]; paras.forEach(function(p){ var parts=p.match(/[^.!?]+[.!?]+["']?\s*|[^.!?]+$/g)||[p], cur='';
  parts.forEach(function(s){ if((cur+s).length>230&&cur){ out.push(cur.trim()); cur=''; } cur+=s; }); if(cur.trim()) out.push(cur.trim()); }); return out; }
function speak(paras){ if(UNDER) return; if(window.CS_LIBRARY&&window.CS_LIBRARY.isPlaying()) return; if(!window.speechSynthesis){ say('Speech is not available in this browser. Use Show text in the Cosmic library instead.'); return; }
  speechSynthesis.cancel(); var list=chunks(paras), v=pickVoice(), i=0; speaking=true; duck(true);
  var nextU=function(){ if(!speaking) return; if(i>=list.length){ speaking=false; duck(false); return; } var u=new SpeechSynthesisUtterance(list[i++]); u.lang='en-GB'; if(v){ try{ u.voice=v; }catch(e){} } u.rate=S.voice.rate/100; u.onend=nextU; u.onerror=function(){ speaking=false; duck(false); }; speechSynthesis.speak(u); };
  nextU(); }
function stopSpeaking(){ speaking=false; try{ speechSynthesis.cancel(); }catch(e){} duck(false); }
function duck(on){ if(!C) return; var t=ctx.currentTime, g=C.duckG.gain; g.cancelScheduledValues(t); g.setValueAtTime(g.value,t); g.setTargetAtTime(on?1-S.voice.duck/100*0.75:1,t,0.6); }
function liveMode(){ $('eraLive').setAttribute('aria-live',S.voice.announce?'polite':'off'); }

/* ---------- sleep timer, wake lock, media session ---------- */
function setTimer(leftSec){ if(!C) return; var p=C.timerG.gain, t=ctx.currentTime; p.cancelScheduledValues(t); p.setValueAtTime(p.value,t); p.setTargetAtTime(1,t,0.3);
  var m=UNDER?0:+S.timer.min; if(!m||!playing){ timerEnd=0; renderTimerLeft(); return; } var len=leftSec!=null?leftSec:m*60, fade=Math.min(len,S.timer.fade*60);
  timerEnd=t+len; var fa=Math.max(t+1.5,timerEnd-fade); p.setValueAtTime(1,fa); p.linearRampToValueAtTime(0.0001,Math.max(fa+0.1,timerEnd)); renderTimerLeft(); }
function timerLeft(){ return timerEnd&&ctx?Math.max(0,timerEnd-ctx.currentTime):0; }
function renderTimerLeft(){ var e=$('timerLeft'); if(!e) return; e.textContent=timerEnd?'About '+minsWords(timerLeft()/60)+' left on the sleep timer.':'The sleep timer is off.'; }
async function wakeLock(){ if(!S.screen.wake||!playing){ releaseWake(); return; } try{ if('wakeLock' in navigator&&!wake){ wake=await navigator.wakeLock.request('screen'); wake.addEventListener('release',function(){ wake=null; }); } }catch(e){} }
function releaseWake(){ if(wake){ try{ wake.release(); }catch(e){} wake=null; } }
function mediaSession(on){ if(!('mediaSession' in navigator)) return; try{ navigator.mediaSession.metadata=new MediaMetadata({title:'Cosmic Sanctuary',artist:seg?E.ERAS[seg.era].name:'A journey through the universe',album:'Cosmic Sanctuary'});
  navigator.mediaSession.playbackState=on?'playing':'paused';
  navigator.mediaSession.setActionHandler('play',function(){ if(!playing) play(); }); navigator.mediaSession.setActionHandler('pause',function(){ pause(); });
  navigator.mediaSession.setActionHandler('nexttrack',function(){ if(J){ E.stepForward(J); if(playing) nextSeg(); } }); navigator.mediaSession.setActionHandler('previoustrack',function(){ if(J){ E.stepBack(J); if(playing) nextSeg(); } }); }catch(e){} }

/* ---------- interruptions: phone calls, Siri, other apps ---------- */
function snap(){ if(!playing||!ctx||!seg) return null; return {v:1,savedAt:Date.now(),journey:J,seg:seg,elapsed:Math.max(0,ctx.currentTime-segStartCtx),timerLeft:timerEnd?timerLeft():null}; }
function saveSession(){ if(UNDER) return; var s=snap(); if(!s) return; lastSave=Date.now(); try{ localStorage.setItem(SESS,JSON.stringify(s)); }catch(e){} }
function readSession(){ try{ var s=JSON.parse(localStorage.getItem(SESS)); if(s&&s.v===1&&s.journey&&s.seg&&Date.now()-s.savedAt<72*3600e3) return s; }catch(e){} return null; }
function clearSession(){ try{ localStorage.removeItem(SESS); }catch(e){} }
function onCtxState(){ if(!playing) return; if(ctx.state!=='running'){ if(!interrupted){ interrupted=true; notRunningSince=Date.now(); saveSession(); } }
  else if(interrupted){ interrupted=false; segEnd=Math.max(segEnd,ctx.currentTime+20); var was=!$('resumeBtn').hidden; hideResume(); if(was) say('Resumed where you left off.'); } }
function nudge(){ if(!ctx) return; if(S.audioMode==='playback'&&unlockEl) unlockEl.play().catch(function(){}); if(S.audioMode==='background') $('liveOut').play().catch(function(){}); if(ctx.state!=='running'&&ctx.state!=='closed') ctx.resume().catch(function(){}); }
function showResume(){ var b=$('resumeBtn'); if(!b.hidden) return; b.hidden=false; say('The sound was interrupted. Press Resume to carry on from where you left off.'); }
function hideResume(){ $('resumeBtn').hidden=true; }
function resumeNow(){ if(!ctx) return; setAudioSession(); nudge(); ctx.resume().then(function(){ setTimeout(function(){ if(ctx.state==='running'){ interrupted=false; hideResume(); say('Resumed where you left off.'); } else say('The phone is still holding the sound. Try Resume again in a moment.'); },400); }).catch(function(){}); }
document.addEventListener('visibilitychange',function(){ if(!document.hidden&&playing){ nudge(); wakeLock(); setTimeout(function(){ if(playing&&ctx.state!=='running') showResume(); },1800); } else if(document.hidden) saveSession(); });
window.addEventListener('pagehide',saveSession);

/* ---------- offline ---------- */
var SOUND_CACHE='cs1-sounds';
async function saveOffline(){ if(!('caches' in window)){ say('This browser cannot save for offline use.'); return; } var all=(MAN?MAN.layers:[]).concat(BOWLS), c=await caches.open(SOUND_CACHE), done=0, bad=0;
  say('Saving '+all.length+' sounds for offline use. This may take a few minutes.');
  for(var i=0;i<all.length;i++){ var u=new URL(urlFor(all[i].id),location.href).href, ok=false; if(await c.match(u)){ done++; continue; }
    for(var a=0;a<3&&!ok;a++){ try{ var r=await fetch(u,{mode:'cors'}); if(!r.ok) throw new Error(r.status); await c.put(u,r); ok=true; }catch(e){ await new Promise(function(r){ setTimeout(r,1000*(a+1)); }); } }
    if(ok) done++; else bad++; if(i%5===4) $('offlineInfo').textContent='Saved '+done+' of '+all.length+'.'; }
  var m=bad?'Saved '+done+' of '+all.length+' sounds. '+bad+' failed; try again later.':'All '+done+' sounds are saved. Cosmic Sanctuary will now work without the internet.'; $('offlineInfo').textContent=m; say(m); }
async function checkOffline(){ if(!('caches' in window)){ say('Offline saving is not available.'); return; } var c=await caches.open(SOUND_CACHE), all=(MAN?MAN.layers:[]).concat(BOWLS), n=0;
  for(var i=0;i<all.length;i++) if(await c.match(new URL(urlFor(all[i].id),location.href).href)) n++; var m=n+' of '+all.length+' sounds are saved for offline use.'; $('offlineInfo').textContent=m; say(m); }

/* ---------- start-up ---------- */
async function init(){ try{ var r=await fetch('sounds.json'); MAN=await r.json(); }catch(e){ MAN={layers:[],bowls:[]}; say('The list of sounds could not be loaded; synthesised sounds will still play.'); }
  MAN.layers.forEach(function(l){ LAY[l.id]=l; }); BOWLS=MAN.bowls||[];
  build(); liveMode();
  $('playBtn').addEventListener('click',function(){ if(UNDER){ if(window.CS_LIBRARY) window.CS_LIBRARY.pause('The library is paused while the soundscape plays.'); underlay(null); play(); return; } playing?pause():play(); }); $('whatBtn').addEventListener('click',whatPlaying);
  $('backBtn').addEventListener('click',function(){ if(!J){ say('Press Play first.'); return; } pausedAt=null; E.stepBack(J); if(playing) nextSeg(); say('Stepping back to era '+((seg?seg.era:0)+1)+': '+E.ERAS[seg?seg.era:0].name+'.'); });
  $('fwdBtn').addEventListener('click',function(){ if(!J){ say('Press Play first.'); return; } pausedAt=null; E.stepForward(J); if(playing){ nextSeg(); if(playing) say('Stepping forward to era '+(seg.era+1)+': '+E.ERAS[seg.era].name+'.'); } });
  $('newBtn').addEventListener('click',function(){ newJourney(true,0); }); $('resumeBtn').addEventListener('click',resumeNow);
  var R=readSession(); if(R){ $('resumeLast').hidden=false; $('resumeLastInfo').textContent='A journey was interrupted in era '+(R.seg.era+1)+', '+E.ERAS[R.seg.era].name+'.'; $('resumeLastBtn').addEventListener('click',function(){ play(R); }); }
  say('Cosmic Sanctuary version 2, soundscape, is ready. '+MAN.layers.length+' real space recordings. Press Play to begin.');
  if('serviceWorker' in navigator&&location.protocol==='https:') navigator.serviceWorker.register('sw.js').catch(function(){}); }
function underlay(o){ if(!MAN) return;
  if(!o){ if(UNDER){ var was=playing; if(was) pause(' '); UNDER=null; J=null; pausedAt=null; if(underG&&ctx) underG.gain.setTargetAtTime(1,ctx.currentTime,0.05); } return; }
  var fresh=!UNDER; UNDER={vol:o.vol}; ensure(); if(underG) underG.gain.setTargetAtTime(Math.max(0.02,o.vol),ctx.currentTime,0.4);
  if(fresh){ if(playing) pause(' '); J=null; pausedAt=null; jumpEra(o.era,true); } else if(!playing) jumpEra(o.era,true); else if(seg&&seg.era!==o.era) jumpEra(o.era,true); }
window.CS_APP={get:function(){ return {S:S,J:J,seg:seg,C:C,ctx:ctx,playing:playing,MAN:MAN,UNDER:UNDER,underG:underG}; },underlay:underlay,isPlaying:function(){ return playing; },isUnder:function(){ return !!UNDER; },play:play,pause:pause,jumpEra:jumpEra,getBuffer:getBuffer,urlFor:urlFor,ensure:ensure};
// rebuild routes when the audio mode changes
var _changed=changed; changed=function(w){ _changed(w); if(w==='audio'&&C){ setAudioSession(); routeOutput(); } };
init();
})();
