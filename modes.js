/* Cosmic Sanctuary version 2: switch between the Soundscape and the Cosmologist Library. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); }, KEY = 'cs2-mode';
  function show(m, user) {
    $('soundPanel').hidden = m !== 'sound'; $('libPanel').hidden = m !== 'lib';
    $('modeSound').checked = m === 'sound'; $('modeLib').checked = m === 'lib';
    try { localStorage.setItem(KEY, m); } catch (e) {}
    if (user) { var b = m === 'lib' ? $('libPlay') : $('playBtn'); if (b) b.focus(); }
  }
  var m = 'sound'; try { m = localStorage.getItem(KEY) || 'sound'; } catch (e) {}
  if (/[?&]mode=lib/.test(location.search)) m = 'lib';
  show(m === 'lib' ? 'lib' : 'sound', false);
  $('modeSound').addEventListener('change', function () { if (this.checked) show('sound', true); });
  $('modeLib').addEventListener('change', function () { if (this.checked) show('lib', true); });
  window.CS_MODES = { show: show };
})();
