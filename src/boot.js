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

  if ('MutationObserver' in window) {
    var observer = new MutationObserver(function (mutations) {
      var linkTags = [];

      mutations.forEach(function (mutation) {
        Array.prototype.forEach.call(mutation.addedNodes, function (addedNode) {
          if (addedNode.localName === 'link' && addedNode.rel === HTMLImports.IMPORT_LINK_TYPE) {
            linkTags.push(addedNode);
          }
        });
      });

      if (linkTags.length > 0) {
        HTMLImports.importer.load(document, function () {
          linkTags.forEach(function (linkTag) {
            HTMLImports.parser.parseLink(linkTag);
            document.dispatchEvent(
              new CustomEvent('LinkTagImported', {bubbles: true, detail: linkTag})
            );
          });
        });
      }

    });

    observer.observe(document.head, { childList: true });
  }
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
