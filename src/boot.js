/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */
(function(){

// bootstrap

// IE shim for CustomEvent
if (typeof window.CustomEvent !== 'function') {
  window.CustomEvent = function(inType, dictionary) {
     var e = document.createEvent('HTMLEvents');
     e.initEvent(inType,
        dictionary.bubbles === false ? false : true,
        dictionary.cancelable === false ? false : true,
        dictionary.detail);
     return e;
  };
}

function bootstrap() {
  // TODO(sorvell): SD polyfill intrusion
  var doc = window.ShadowDOMPolyfill ? 
      window.ShadowDOMPolyfill.wrapIfNeeded(document) : document;
  // preload document resource trees
  HTMLImports.importer.load(doc, function() {
    HTMLImports.parser.parse(doc, function() {;
      HTMLImports.ready = true;
      HTMLImports.readyTime = new Date().getTime();
      // send HTMLImportsLoaded when finished
      console.warn('firing HTMLImportsLoaded');
      doc.dispatchEvent(
        new CustomEvent('HTMLImportsLoaded', {bubbles: true})
      );
    })
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

})();
