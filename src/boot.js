/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */
(function(){

// bootstrap

// IE shim for CustomEvent
if (typeof window.CustomEvent !== 'function') {
  window.CustomEvent = function(inType) {
     var e = document.createEvent('HTMLEvents');
     e.initEvent(inType, true, true);
     return e;
  };
}

function bootstrap() {
  // preload document resource trees
  HTMLImports.importer.load(document, function() {
    HTMLImports.parser.parse(document);
    HTMLImports.ready = true;
    HTMLImports.readyTime = new Date().getTime();
    // send HTMLImportsLoaded when finished
    document.dispatchEvent(
      new CustomEvent('HTMLImportsLoaded', {bubbles: true})
    );
  });
}

// Allow for asynchronous loading when minified
// readyState 'interactive' is expected when loaded with 'async' or 'defer' attributes
// note: use interactive state only when not on IE since it can become 
// interactive early (see https://github.com/mobify/mobifyjs/issues/136)
if (document.readyState === 'complete' ||
    (document.readyState === 'interactive' && !window.attachEvent)) {
  bootstrap();
} else {
  window.addEventListener('DOMContentLoaded', bootstrap);
}

/*
var bootstrapper = bootstrap;

if (HTMLImports.useNative) {
  function findScriptPath(fileName) {
    var script = document.querySelector('script[src*="' + fileName + '"]');
    var src = script.attributes.src.value;
    return src.slice(0, src.indexOf(fileName));
  }

  function nativeBootstrap() {
    var s = document.createElement('script');
    s.async = true;
    s.src = findScriptPath('boot.js') + 'bootstrap-native.js';
    document.head.appendChild(s);
  }
  bootstrapper = nativeBootstrap;
}

// Allow for asynchronous loading when minified
// readyState 'interactive' is expected when loaded with 'async' or 'defer' attributes
// note: use interactive state only when not on IE since it can become 
// interactive early (see https://github.com/mobify/mobifyjs/issues/136)
if (document.readyState === 'complete' ||
    (document.readyState === 'interactive' && !window.attachEvent)) {
  bootstrapper();
} else {
  window.addEventListener('DOMContentLoaded', bootstrapper);
}


// exports
HTMLImports.bootstrap = bootstrap;
*/
})();
