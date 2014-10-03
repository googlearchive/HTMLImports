/*
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */
(function(scope){

if (scope.useNative) {
  return;
}

// imports
var rootDocument = scope.rootDocument;

/*
  Bootstrap the imports machine.
*/
function bootstrap() {
  HTMLImports.importer.bootDocument(rootDocument);
}
  
// TODO(sorvell): SD polyfill does *not* generate mutations for nodes added
// by the parser. For this reason, we must wait until the dom exists to 
// bootstrap.
if (document.readyState === 'complete' ||
    (document.readyState === 'interactive' && !window.attachEvent)) {
  bootstrap();
} else {
  document.addEventListener('DOMContentLoaded', bootstrap);
}

})(HTMLImports);
