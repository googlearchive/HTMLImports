/*
 * Copyright 2013 The Toolkitchen Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

if (window.top === window) {
  // if standalone
  window.done = function() {
    var d = document.createElement('pre');
    d.style.cssText = 'padding: 6px; background-color: lightgreen;';
    d.textContent = 'Passed';
    document.body.insertBefore(d, document.body.firstChild);
  }
  window.onerror = function(x) {
    var d = document.createElement('pre');
    d.style.cssText = 'padding: 6px; background-color: #FFE0E0;';
    d.textContent = 'FAILED: ' + x + '\n\n' + lastError.stack;
    document.body.insertBefore(d, document.body.firstChild);
  };
} else {
  // if part of a test suite
  window.done = function() {
    top.postMessage('ok', '*');
  }
  window.onerror = function(x) {
    top.postMessage(x + '=> [' + lastError.stack + ']', '*');
    top.postMessage(x, '*');
  };
}

[
  '../../node_modules/chai/chai.js',
  '../lib/after-chai.js'
].forEach(function(inSrc) {
  document.write('<script src="' + inSrc + '"></script>');
});
