/* Cosmic Sanctuary: the eras of the universe, their sound recipes, and the Cosmologist texts.
   To add an era: add an object to ERAS (keep order), give it a recipe and text. Real recordings join an era
   automatically when their entry in sounds.json lists the era number. */
(function(root){
'use strict';
// synth levels are 0..1 before the group volume. motifs: [name, at (0..1 through the era)]
var ERAS=[
{ id:'bigbang', name:'Before and at the Big Bang', short:'Quantum confusion', mood:'confused', weight:0.8,
  colour:{fear:0.1,create:0.1,confuse:1,still:0.2}, realLevel:0.75, realCount:[1,2],
  synth:{hiss:0.7,plasma:0.25,sub:0.15}, cutoff:3200, width:0.55, pitch:1.0,
  motifs:[['puzzle',0.15],['puzzle',0.7]] },
{ id:'inflation', name:'Inflation', short:'Space stretches in an instant', mood:'confused', weight:0.7,
  colour:{fear:0.2,create:0.4,confuse:0.8,still:0.1}, realLevel:0.75, realCount:[1,2],
  synth:{hiss:0.45,drone:0.55,sub:0.2}, cutoff:2600, width:0.9, pitch:0.97, widen:true,
  motifs:[['redshift',0.1],['symmetry',0.55],['darkenergy',0.8]] },
{ id:'soup', name:'Quark and gluon plasma: the particle soup', short:'A seething mess', mood:'messy', weight:0.9,
  colour:{fear:0.3,create:0.2,confuse:0.9,still:0}, realLevel:0.85, realCount:[2,3],
  synth:{plasma:0.6,grit:0.45,hiss:0.3}, cutoff:2400, width:0.8, pitch:1.0,
  motifs:[['puzzle',0.4],['cooling',0.85]] },
{ id:'nucleo', name:'Nucleosynthesis: the first three minutes', short:'The first nuclei forge', mood:'messy', weight:0.8,
  colour:{fear:0.2,create:0.5,confuse:0.6,still:0.1}, realLevel:0.85, realCount:[2,3],
  synth:{plasma:0.35,drone:0.35,grit:0.25,ignite:0.15}, cutoff:2200, width:0.75, pitch:1.0,
  motifs:[['cooling',0.3],['cooling',0.75]] },
{ id:'recomb', name:'Recombination and first light', short:'The fog clears: the cosmic microwave background', mood:'ordering', weight:1.0,
  colour:{fear:0,create:0.4,confuse:0.2,still:0.6}, realLevel:0.85, realCount:[2,2],
  synth:{shimmer:0.5,cmb:0.35,drone:0.25,hiss:0.12}, cutoff:4200, width:0.8, pitch:1.0,
  motifs:[['cooling',0.1],['cmb',0.35],['puzzle',0.8]] },
{ id:'dark', name:'The Dark Ages', short:'No stars yet; gravity gathers', mood:'still', weight:1.1,
  colour:{fear:0.4,create:0.1,confuse:0.1,still:1}, realLevel:0.8, realCount:[1,2],
  synth:{sub:0.55,drone:0.3,beating:0.12}, cutoff:900, width:0.7, pitch:0.96,
  motifs:[['gravity',0.3],['gravity',0.75]] },
{ id:'dawn', name:'Cosmic dawn: the first stars', short:'Light switches on', mood:'creative', weight:1.0,
  colour:{fear:0.1,create:1,confuse:0.2,still:0.3}, realLevel:0.85, realCount:[2,3],
  synth:{ignite:0.55,shimmer:0.3,drone:0.3,sub:0.15}, cutoff:4000, width:0.8, pitch:1.0,
  motifs:[['gravity',0.15],['ignition',0.5]] },
{ id:'reion', name:'Reionisation', short:'Starlight clears the fog a second time', mood:'creative', weight:0.9,
  colour:{fear:0.2,create:0.7,confuse:0.4,still:0.3}, realLevel:0.85, realCount:[2,3],
  synth:{shimmer:0.35,grit:0.25,ignite:0.3,drone:0.25}, cutoff:4200, width:0.85, pitch:1.0,
  motifs:[['ignition',0.4]] },
{ id:'galaxies', name:'Galaxies and black holes', short:'The violent universe', mood:'frightening', weight:1.2,
  colour:{fear:1,create:0.3,confuse:0.4,still:0}, realLevel:0.9, realCount:[2,3],
  synth:{rumble:0.6,beating:0.45,bloom:0.2,sub:0.3}, cutoff:1500, width:0.85, pitch:0.98,
  motifs:[['gravity',0.2],['merger',0.5],['chirp',0.8]] },
{ id:'supernovae', name:'Supernovae forge the elements', short:'Creative power', mood:'creative', weight:1.1,
  colour:{fear:0.4,create:1,confuse:0.2,still:0.1}, realLevel:0.9, realCount:[2,3],
  synth:{bloom:0.5,ignite:0.3,pulsar:0.3,shimmer:0.2}, cutoff:3600, width:0.9, pitch:1.0,
  motifs:[['pulsar',0.3],['bloom',0.6]] },
{ id:'solar', name:'Our Sun and the planets form', short:'Dust becomes worlds', mood:'creative', weight:1.0,
  colour:{fear:0.1,create:0.8,confuse:0.3,still:0.4}, realLevel:0.9, realCount:[2,3],
  synth:{grit:0.45,drone:0.3,shimmer:0.2,ignite:0.15}, cutoff:3000, width:0.8, pitch:1.0,
  motifs:[['gravity',0.25],['grit',0.6]] },
{ id:'earth', name:'Earth and the living universe', short:'The cosmos becomes aware of itself', mood:'still', weight:1.0,
  colour:{fear:0,create:0.6,confuse:0.1,still:0.8}, realLevel:0.9, realCount:[2,3],
  synth:{drone:0.3,shimmer:0.25,sub:0.12}, cutoff:3200, width:0.75, pitch:1.0,
  motifs:[['puzzle',0.6]] },
{ id:'future', name:'The far future', short:'Heat death, or something unknown', mood:'still', weight:1.1,
  colour:{fear:0.5,create:0.1,confuse:0.2,still:1}, realLevel:0.85, realCount:[1,2],
  synth:{sub:0.4,drone:0.4,hiss:0.1}, cutoff:1100, width:1.0, pitch:0.95, widen:true,
  motifs:[['darkenergy',0.2],['redshift',0.5],['puzzle',0.85]] }
];
var TEXT={
bigbang:[
'Era one: before and at the Big Bang. Quantum confusion.',
'What is happening. When we run the expansion of the universe backwards, everything we can see today, every galaxy, crowds into a state hotter and denser than anything we can make or even properly describe. That moment is about 13.8 billion years ago. The Big Bang was not an explosion at one point in empty space. It was space itself beginning to stretch, everywhere at once, with no centre and no outside.',
'Our best theories stop working in the very first instant. General relativity, the theory of gravity, and quantum theory, the theory of the very small, give contradictory answers when both matter at once. In the first ten-millionth of a trillionth of a trillionth of a trillionth of a second, even space and time may not behave like space and time. Physicists call this the Planck era, and nobody yet knows its rules.',
'What you are hearing. A hiss with no pitch and no direction: no structure, no up or down, nothing to hold on to. Behind it, very faintly, a real tone made from the sound waves that later rang through the young universe, like a memory of what is to come. And now and then a suspended chord that never resolves. In this app, that chord always means: this is a question science has not answered.',
'The open questions. Was there a before? Stephen Hawking and James Hartle suggested that asking what came before the Big Bang may be like asking what lies north of the North Pole: time itself might round off smoothly. Others think the universe tunnelled into existence from a quantum fluctuation. But a quantum nothing is not truly nothing; it still has laws, and we would still want to know why those laws exist. Cyclic models, such as Roger Penrose\'s conformal cyclic cosmology, or the bouncing universes of Paul Steinhardt and Neil Turok, propose that our Big Bang followed an earlier universe. Eternal inflation suggests ours is one bubble among countless others. None of these is proven.',
'And behind all of them sits the oldest question, asked by Leibniz three hundred years ago: why is there something rather than nothing? Physics can explain how one state follows from another. It is not yet clear that it can ever explain why there is anything at all. At this point the universe is not frightening. It is simply confused, without place, without order, perhaps without time.'],
inflation:[
'Era two: inflation. Space stretches in an instant.',
'What is happening. Most cosmologists think that in a tiny fraction of the first second, space expanded by an enormous factor, at least a hundred trillion trillion times, all over within roughly a hundred-millionth of a trillionth of a trillionth of a second. A region smaller than a proton swelled to something perhaps the size of a grapefruit or far larger. This is cosmic inflation, proposed by Alan Guth in 1980 and developed by Andrei Linde, Alexei Starobinsky and others.',
'Why believe it? It solves three puzzles at once. The horizon problem: opposite sides of the sky have the same temperature to within one part in a hundred thousand, yet in a normal Big Bang they could never have been in contact. Inflation says they were neighbours before being flung apart. The flatness problem: space today is almost perfectly flat, which needs extraordinarily fine balance, and inflation flattens space the way blowing up a balloon flattens a patch of its surface. And the seeds: tiny quantum jitters were stretched across the sky and became the slightly denser regions that later grew into galaxies. If this is right, every galaxy, and so every person, began as magnified quantum noise.',
'What you are hearing. Tones that slide slowly downwards as if stretched: this is the redshift motif, waves lengthening as space grows. The stereo field widens, which is space opening. Listen too for a single drone that splits into several separate voices. That is the symmetry-breaking motif: in many theories, forces that were one become distinct as the universe cools.',
'The open questions. Inflation fits the pattern of ripples in the cosmic microwave background beautifully, but it is not proven. Its clearest fingerprint, a faint twist in the polarisation of that light caused by primordial gravitational waves, has been searched for and not yet found; a famous claim in 2014 turned out to be dust in our own galaxy. Many versions of inflation never stop everywhere at once. Inflation keeps going in most places, and bubble universes keep forming, perhaps each with different physics. That is the inflationary multiverse. Some physicists find it natural; others say an idea that cannot be tested is not yet science. When inflation ended, its energy poured into particles and radiation, and the hot Big Bang we usually talk about began. Confusion is turning into a mess.'],
soup:[
'Era three: the quark and gluon plasma. The particle soup.',
'What is happening. In the first millionths of a second, the universe was hotter than a trillion degrees. Protons and neutrons could not exist; their ingredients, quarks, and the gluons that bind them, moved freely in a seething plasma. Particles and antiparticles were constantly made out of pure energy and destroyed again. At about a trillionth of a second, the Higgs field settled into its present value, giving many particles their mass, and the weak nuclear force split off from electromagnetism.',
'Physicists have recreated tiny drops of this soup by smashing gold and lead nuclei together at Brookhaven in New York and at CERN. To everyone\'s surprise it behaves not like a gas but like an almost perfect liquid, flowing with less friction than anything else known.',
'At around ten millionths of a second, it had cooled enough for quarks to be locked away for ever inside protons and neutrons. At about one second, ghostly particles called neutrinos stopped interacting and have been flying freely ever since; a cosmic neutrino background must still fill the universe, though we have not yet detected it directly.',
'What you are hearing. Real recordings of plasma, electrically charged gas, from our own solar system: Voyager in interstellar space, Juno crossing Jupiter\'s shock wave, Cassini in Saturn\'s rings, and Jupiter\'s radio storms. Today\'s plasmas are vastly cooler and thinner, so treat them as a sound portrait of the soup, not a recording of it. The grit and crackle are collisions. At the end, listen for noise slowly narrowing into a pure tone: that is the cooling motif.',
'The open question. For every billion antiquarks there seem to have been about a billion and one quarks. Matter and antimatter annihilated in a blaze of light, and that tiny excess of one in a billion is everything that exists today: stars, planets, you. Why the imbalance? Physics knows a few ways matter and antimatter behave differently, but they are far too weak to explain it. That is why the unresolved suspended chord returns here. This is the universe at its messiest.'],
nucleo:[
'Era four: nucleosynthesis. The first three minutes.',
'What is happening. From about one second to about twenty minutes after the beginning, the whole universe was like the core of a star, but cooling fast. Protons and neutrons collided and fused. Almost all the neutrons ended up inside helium nuclei, so that about a quarter of all ordinary matter became helium, with traces of deuterium, which is heavy hydrogen, helium three and a pinch of lithium. The rest stayed as single protons: hydrogen.',
'There was a clock running. A neutron on its own decays in about fifteen minutes on average, so fusion had to happen quickly, and the exact ratio of helium to hydrogen depends on the timing. The predicted amounts match what we measure in the oldest stars and in pristine gas clouds lit up by distant quasars. This is one of the strongest pieces of evidence that the hot Big Bang really happened.',
'After about twenty minutes the universe was too cool and too thin for more fusion. Carbon, oxygen, iron, every heavier element, would have to wait hundreds of millions of years for stars.',
'What you are hearing. The real vibrations of our own Sun, measured by the SOHO spacecraft and sped up so you can hear a star ringing. It is fusing hydrogen into helium today, just as the whole universe did for those few minutes. Listen for the cooling motif: hiss narrowing, again and again, into clearer tone, as the mess begins to organise itself.',
'The open question. The theory predicts about three times more lithium seven than we find in old stars. This is the cosmological lithium problem. It may be something about how stars destroy lithium, or a sign of new physics. It is still unsolved.'],
recomb:[
'Era five: recombination and first light. The cosmic microwave background.',
'What is happening. For 380,000 years the universe was a glowing fog. Light could not travel far before bouncing off a free electron, much like sunlight in thick cloud. Then the temperature fell to about three thousand degrees, roughly the surface of a cool star, and electrons settled onto nuclei to make neutral atoms. Suddenly light could travel freely. The fog cleared.',
'That light is still arriving from every direction in the sky. Expansion has stretched its waves about a thousand times, so it is now microwaves at less than three degrees above absolute zero: the cosmic microwave background. Arno Penzias and Robert Wilson found it by accident in 1965 as a hiss in their radio antenna, and at first suspected pigeon droppings. A small part of the snow on an old analogue television was this light.',
'Before the fog cleared, the plasma rang with real sound waves: gravity pulled matter in, the pressure of light pushed it back out, again and again. When the light escaped, the pattern froze. The Planck and WMAP satellites mapped it as a pattern of hot and cold spots, with a fundamental tone and overtones, rather like the harmonics of an instrument. From that pattern, cosmologists have measured that space is flat, that ordinary matter is only about five percent of everything, dark matter about twenty seven percent, and dark energy about sixty eight percent.',
'What you are hearing. NASA\'s sonification of the Planck sound waves, raised by about fifty octaves. Glass-like shimmer for light breaking free. And the CMB chord motif: three tones spaced in the same proportions as the first three peaks in the Planck pattern. It is, quite literally, the first chord the universe played.',
'The open question. The temperature is the same in every direction to one part in a hundred thousand. Inflation is the leading explanation of why, which is why the suspended puzzle chord returns near the end of this era. After the mess, this is order: calm, transparent, and full of light.'],
dark:[
'Era six: the Dark Ages.',
'What is happening. After the first light escaped, it cooled from orange to red to invisible infrared. For around a hundred million years or more there were no stars at all. The universe was a vast, slowly thinning sea of hydrogen and helium gas in total darkness.',
'But it was not idle. Gravity was working. Most matter is dark matter, about five times more than ordinary matter. It gives out no light and seems to feel only gravity. It began to clump first, into a cosmic web of filaments and knots called haloes. Ordinary gas then fell into those haloes, getting denser and warmer.',
'What you are hearing. A deep sub-bass, the quietest real recordings, such as Voyager listening to the thin gas between the stars, and the gravity motif: sounds that start far apart in the stereo field and slowly drift together into clumps, the way matter gathered.',
'The open questions. What is dark matter? It has been searched for in deep underground laboratories, in particle colliders and in space for decades, without a confirmed detection. Leading ideas include weakly interacting massive particles and very light particles called axions; a minority of physicists think gravity itself works differently on large scales. The Dark Ages may one day be heard directly in faint radio light from hydrogen, and there are plans for radio telescopes on the far side of the Moon, away from Earth\'s noise. A 2018 claim of such a signal, from the EDGES experiment, has not been confirmed. This era is stillness, but a held breath.'],
dawn:[
'Era seven: cosmic dawn. The first stars.',
'What is happening. Somewhere between about one hundred and two hundred million years after the beginning, gas inside the dark matter haloes became dense and hot enough for nuclear fusion. The first stars switched on. They were made only of hydrogen and helium, so they were probably enormous, tens or even hundreds of times the mass of the Sun, blazing blue-white and living only a few million years.',
'No one has yet seen one of these first stars directly. The James Webb Space Telescope is searching, and it has already found galaxies that are surprisingly bright and mature only three hundred million years or so after the Big Bang, which is forcing astronomers to rethink how quickly stars and galaxies formed.',
'What you are hearing. Swells of rising tone, the ignition motif, one for each star igniting. And real sonifications of star birth today: the Pillars of Creation, the cosmic cliffs of the Carina Nebula, and the young cluster Westerlund 2. Modern stars are a portrait of the first ones, not a recording of them.',
'The mood. This is where the universe\'s creative power first shows itself. After a hundred million years of darkness, light, made by matter itself.'],
reion:[
'Era eight: reionisation.',
'What is happening. The fierce ultraviolet light of the first stars and galaxies, and later of quasars, began to tear electrons off the neutral hydrogen between the galaxies. Bubbles of ionised, transparent gas grew around each galaxy and merged, like holes spreading through Swiss cheese, until by about one billion years after the beginning almost all the gas between galaxies was ionised again. That is why it is called reionisation.',
'We see the end of this era in the light of very distant quasars, whose spectra show a dark trough where neutral hydrogen was still absorbing, and in the polarisation of the cosmic microwave background.',
'What you are hearing. The Hubble Ultra Deep Field sonification, a note for every galaxy, from the farthest and oldest to the nearest. Crackling radio and the chorus of charged particles. Bright shimmer for spreading bubbles of light.',
'The open question. Which did most of the work: countless small galaxies or a few brilliant quasars? Webb\'s observations suggest small galaxies made more ultraviolet light than expected, possibly too much, which is a new puzzle in itself.'],
galaxies:[
'Era nine: galaxies and black holes. The violent universe.',
'What is happening. Galaxies grew by swallowing gas and by colliding and merging with one another. At the centre of nearly every large galaxy sits a supermassive black hole, millions or billions of times the mass of the Sun. When gas falls towards one, it heats up and can outshine all the stars of its galaxy combined: a quasar. Black holes fire jets far beyond their galaxies and blow out bubbles that heat surrounding gas.',
'You are hearing some of this directly. The black hole in the Perseus galaxy cluster sends real pressure waves, sound waves, through the hot gas around it. Their true pitch is about fifty seven octaves below middle C; Chandra\'s data have been raised so we can hear them. M87, whose black hole was the first ever imaged in 2019. Our own galaxy\'s black hole, Sagittarius A star. The Bullet Cluster, where two clusters smashed through each other and the invisible dark matter separated from the hot gas, perhaps the clearest evidence that dark matter is real.',
'And now and then, a rising chirp. In September 2015, LIGO felt space itself stretch and squeeze by less than a thousandth of the width of a proton, as two black holes about thirty six and twenty nine times the mass of the Sun merged 1.3 billion years ago. In a fraction of a second, three Suns\' worth of mass became pure gravitational waves.',
'The motifs. Two tones slowly beating against each other and drifting together: the galaxy merger motif. A low rumble for black holes. Clumping in the stereo field for gravity.',
'The open questions and the mood. How did giant black holes grow so big so early, when Webb sees them less than a billion years after the beginning? What happens to information that falls into a black hole? Stephen Hawking showed black holes slowly leak radiation and should one day evaporate, which seems to destroy information, something quantum theory forbids. This is the frightening universe. And yet the black holes\' violence also regulates how fast galaxies make stars. Destruction and creation are partners here.'],
supernovae:[
'Era ten: supernovae forge the elements. Creative power.',
'What is happening. Stars are element factories. They fuse hydrogen into helium, then in bigger stars helium into carbon and oxygen, and onwards through neon, silicon and finally iron. Iron is the end of the line: fusing it takes energy instead of releasing it. In less than a second the core of a massive star collapses, rebounds and blasts the star apart in a supernova that can briefly outshine a whole galaxy. The elements it made are flung into space.',
'Many of the heaviest elements, including much of the gold and platinum, are probably made when two neutron stars collide. In 2017, astronomers saw this happen: gravitational waves and then light from a kilonova 130 million light years away.',
'The calcium in your bones, the iron in your blood and the oxygen you breathe were made inside stars that died before the Sun was born. As Carl Sagan put it, we are made of star stuff.',
'What you are hearing. Real Chandra sonifications of supernova remains: Cassiopeia A, Tycho\'s supernova of 1572, the Crab Nebula from the explosion seen in 1054, and Supernova 1987A. Slow blooming swells for explosions. And the pulsar motif: clicks at the real spin rates of pulsars, the collapsed cores left behind. The Vela pulsar turns about eleven times a second; the Crab pulsar about thirty times a second. Each is a ball of neutrons about the size of a city, heavier than the Sun.',
'The mood. This is the universe\'s almost unlimited creative power: every death enriches the next generation of stars.'],
solar:[
'Era eleven: our Sun and the planets form.',
'What is happening. About 4.6 billion years ago, more than nine billion years after the Big Bang, a cloud of gas and dust enriched by earlier generations of stars collapsed under its own gravity, perhaps nudged by a nearby supernova; certain short-lived radioactive elements in meteorites hint at this. At the centre the Sun ignited. Around it spun a flat disc. Dust grains stuck together into pebbles, pebbles into bodies kilometres across, and those collided and merged into planets: rocky worlds near the Sun, and beyond the frost line, where ice could form, the giants Jupiter and Saturn.',
'It was not gentle. The Moon probably formed when a Mars-sized body, often called Theia, struck the young Earth. Jupiter may have wandered inwards and then back out again, scattering material and shaping the whole solar system.',
'What you are hearing. The real Sun ringing, from SOHO. Jupiter\'s natural radio storms. Juno crossing Jupiter\'s shock wave. Saturn\'s radio emissions and the dust of its rings striking Cassini. Parker Solar Probe skimming Venus. And the granular grit motif: tiny grains of sound clustering into clumps, dust becoming worlds.',
'The open question. How common are systems like ours? We now know thousands of planets around other stars, and many look nothing like the solar system: giant planets hugging their stars, or worlds between Earth and Neptune in size, a kind we do not have at all.'],
earth:[
'Era twelve: Earth and the living universe.',
'What is happening. Earth formed about 4.54 billion years ago. Life appeared remarkably early, by at least 3.5 billion years ago and possibly earlier. Tiny organisms learned to use sunlight and filled the air with oxygen. Complex animals appeared about six hundred million years ago, and our own species only about three hundred thousand years ago. Earth\'s magnetic field shields life from the solar wind; the chirping chorus and whistles you hear are radio waves dancing in that field.',
'Mars was once wetter, with rivers and lakes. Today we have heard its thin wind and felt its quakes, through NASA\'s InSight lander and the Perseverance rover.',
'What you are hearing. Earth\'s chorus and Earth\'s song from the Van Allen Probes, wind on Mars, and a marsquake, all real.',
'The open questions. Is life common or rare? With thousands of known planets, the galaxy may hold billions of places where life could exist, yet we have found no sign of anyone else. This is the Fermi paradox. And there is the fine-tuning puzzle: change the strength of gravity or of the nuclear forces a little, and stars, chemistry or life might be impossible. Is that coincidence, a sign of a deeper law, a multiverse in which we naturally find ourselves in a life-friendly corner, or something else? People of science and of faith answer differently. Carl Sagan said that we are a way for the cosmos to know itself. Here the universe becomes aware of itself, and asks why.'],
future:[
'Era thirteen: the far future. Heat death, or something unknown.',
'What is happening. In 1998, two teams measuring distant exploding stars discovered that the expansion of the universe is speeding up. Whatever drives this is called dark energy, and it makes up about two thirds of everything, but nobody knows what it is.',
'Close to home: the Andromeda galaxy is heading towards our Milky Way. A merger in about five billion years was long thought certain; recent studies put the chance over the next ten billion years at closer to even. In about five billion years the Sun will swell into a red giant, then shrink to a white dwarf. Over trillions of years star formation will fade; the smallest red dwarf stars will glow for trillions more, and then go out. After that comes the black hole era, until even black holes slowly evaporate through Hawking radiation, over a time with about a hundred zeros. If dark energy stays constant, the end is heat death: everything spread out, the same temperature everywhere, nothing left to happen.',
'Other endings are possible. If dark energy grows stronger, a Big Rip could one day tear galaxies, stars and atoms apart. If it weakens and reverses, the universe could collapse in a Big Crunch; recent measurements from the DESI survey hint that dark energy may be changing over time, but this is not settled. The Higgs field may even be only temporarily stable. And Roger Penrose suggests that the empty, endless far future might itself become the Big Bang of a new universe. That is why, in endless mode, this app begins a new universe after this era, each one a little different.',
'What you are hearing. The dark energy motif: the stereo field slowly widening, sounds drifting apart. Redshift: tones stretching downwards. Andromeda, the Cat\'s Eye Nebula, a dying star gently shedding its layers, and the wind of an empty world. And the puzzle chord, because this is the biggest unknown of all. Some find this era frightening; others find it the deepest stillness there is.']
};
var LIBRARY=[
{ id:'listen', title:'How to listen: what the sounds are', text:[
'Space is mostly silent, because sound needs something to travel through. But space is not empty. It is full of thin electrically charged gas called plasma, and that gas really does vibrate. Spacecraft such as Voyager, Juno and Cassini carry instruments that measure these vibrations as radio waves. Scientists shift them into the range of human hearing, and what you hear is real.',
'Other sounds are sonifications: data turned into sound. A telescope image is scanned, and brightness becomes loudness or pitch. Chandra\'s X-ray images, Hubble\'s deep fields and Webb\'s nebulae have all been sonified by NASA with the SYSTEM Sounds team. The Perseus black hole is different again: astronomers found real pressure waves in the gas around it and raised their pitch by fifty seven octaves.',
'The rest of Cosmic Sanctuary is synthesised in your phone: the hiss, drones, shimmer, swells and teaching motifs. They are designed to carry ideas, not to pretend to be recordings. The credits page lists every recording, where it came from and its licence.']},
{ id:'beginnings', title:'Theories of the beginning', text:[
'The standard hot Big Bang theory is extremely well tested from about one second onwards. Before that, we are on less certain ground.',
'Inflation: a burst of extreme expansion in the first instant, which explains why the universe is so smooth and flat and where the seeds of galaxies came from. It is the leading idea, with strong support from the cosmic microwave background, but not proven.',
'Eternal inflation and the multiverse: in many versions, inflation never stops everywhere, and our universe is one bubble among countless others, perhaps with different laws in each.',
'Quantum creation: the idea that the universe arose from a quantum fluctuation, or tunnelled into existence. The no-boundary proposal of Hawking and Hartle suggests time itself has no sharp beginning.',
'Bounces and cycles: perhaps our Big Bang followed the collapse of an earlier universe, or, in Roger Penrose\'s conformal cyclic cosmology, the empty far future of one universe becomes the Big Bang of the next.',
'String theory and quantum gravity: attempts to combine gravity with quantum physics, which might one day say what really happened at the start. None has yet made a confirmed prediction.']},
{ id:'something', title:'Why is there something rather than nothing?', text:[
'The philosopher Gottfried Leibniz asked this in 1714, and it is still open. Physics explains how one state of the world leads to another, using laws. When physicists say the universe could come from nothing, they usually mean from a quantum vacuum, or from a state with no space and time, but still governed by quantum laws. A philosopher can fairly ask: why those laws, and why anything at all?',
'Some answers people have given: there is simply no explanation, the universe is a brute fact; nothingness is unstable, so something had to happen; every possible universe exists, so ours needs no special reason; or the universe has a cause beyond itself, which many religious traditions call God. Science has not settled the question and may never be able to. It is a fine thing to wonder about in the dark.']},
{ id:'puzzles', title:'The great unsolved puzzles', text:[
'The horizon problem: why the sky has the same temperature everywhere. Inflation is the leading answer.',
'Matter against antimatter: why there was a tiny excess of matter, one part in a billion, that became everything.',
'Dark matter: about five times more than ordinary matter, holding galaxies together, never directly detected.',
'Dark energy: what is making the expansion speed up, and is it changing over time?',
'The Hubble tension: measurements of how fast the universe is expanding today disagree, depending on whether you start from the early universe or from nearby stars.',
'Quantum gravity: how to combine Einstein\'s gravity with quantum physics, which we need to understand the very beginning and the insides of black holes.',
'The lithium problem: too little lithium in old stars.',
'Early giants: Webb sees bright galaxies and big black holes earlier than expected.',
'In Cosmic Sanctuary, every one of these is marked by the same suspended chord that never resolves.']},
{ id:'calendar', title:'The cosmic calendar', text:[
'Imagine squeezing the whole 13.8 billion year history of the universe into one year. The Big Bang is the first moment of the first of January. Each day is then about 38 million years.',
'The first stars switch on in the first week of January. The oldest stars of our Milky Way form in early January, and its disc takes shape in the spring. The Sun and Earth do not form until early September. The first life on Earth appears in late September.',
'Complex animals appear in mid December. The dinosaurs arrive around Christmas Day and die out on the thirtieth of December. Our own species appears at about ten minutes to midnight on New Year\'s Eve, and the whole of recorded history fits into the last dozen seconds.']}
];
var MOTIFS=[
{ id:'redshift', name:'Redshift: expansion', text:'Tones slowly stretch downwards in pitch. As space expands, the waves of light travelling through it are stretched too, shifting towards red and longer wavelengths. Here sound stands in for light: the longer the stretch, the lower the pitch.' },
{ id:'cooling', name:'Cooling: noise becomes tone', text:'A hiss gradually narrows until it becomes a single clear note. A hot universe is chaotic, with energy everywhere at once; as it cools, structure and order appear. Each time you hear noise resolve into a tone, the universe has cooled and become more organised.' },
{ id:'symmetry', name:'Symmetry breaking: one becomes many', text:'One drone splits into several voices that drift apart into a chord. In the hot early universe, forces that are separate today are thought to have behaved as one. As it cooled, that symmetry broke, the way water freezing into ice picks out particular directions. The electromagnetic and weak forces really did separate at about a trillionth of a second; earlier unifications are still theory.' },
{ id:'gravity', name:'Gravity: clumping', text:'Small sounds start spread across the whole stereo field and slowly drift together into a few clusters. Gravity takes a nearly smooth universe and gathers matter into filaments, galaxies and stars.' },
{ id:'darkenergy', name:'Dark energy: widening', text:'The whole sound field slowly widens, and sounds drift apart towards the far left and far right. Dark energy is making the expansion of the universe speed up, carrying galaxies away from one another.' },
{ id:'puzzle', name:'The unanswered puzzle', text:'A suspended chord that never resolves to a home note. It marks the questions science has not answered: what came before, why there is more matter than antimatter, why the sky is so uniform, what dark matter and dark energy are.' },
{ id:'cmb', name:'The first chord: the cosmic microwave background', text:'Three tones in the same proportions as the first three peaks in the Planck satellite\'s map of the cosmic microwave background. Those peaks are the fundamental and overtones of real sound waves that rang through the universe for its first 380,000 years.' },
{ id:'ignition', name:'Ignition: a star switches on', text:'A swell that rises and brightens, then settles into a steady glow: gas collapsing under gravity until it is hot enough for fusion, and a star switches on.' },
{ id:'merger', name:'Galaxy merger: slow beating', text:'Two tones a fraction apart in pitch beat slowly against each other while drifting together from left and right, the way two galaxies circle and merge over hundreds of millions of years. The beating quickens as they close.' },
{ id:'chirp', name:'Gravitational wave chirp', text:'A rising sweep that ends suddenly: the shape of the signal from two black holes spiralling together, like the one LIGO heard in 2015. As they get closer they orbit faster, so the pitch rises until they merge.' },
{ id:'pulsar', name:'Pulsars: cosmic clocks', text:'Clicks at the real spin rates of pulsars: the Vela pulsar at about eleven turns a second, and the Crab pulsar at about thirty. Each click is one turn of a collapsed star the size of a city.' },
{ id:'bloom', name:'Supernova bloom', text:'A deep boom that opens into a bright, slowly fading bloom: a star exploding and scattering newly forged elements into space.' },
{ id:'grit', name:'Dust becoming worlds', text:'Tiny grains of sound, scattered at first, begin to fall into rhythms and clumps: dust in the young solar system sticking together into pebbles, rocks and planets.' }
];
var API={ERAS:ERAS,TEXT:TEXT,LIBRARY:LIBRARY,MOTIFS:MOTIFS};
if(typeof module!=='undefined'&&module.exports) module.exports=API; else root.CS_ERAS=API;
})(this);
