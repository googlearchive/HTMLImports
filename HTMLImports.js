/*
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */
(function() {
  
var thisFile = 'HTMLImports.js';

/*
  Provides api compatibility. Should be loaded even when native
  HTMLImports is available.
*/
var baseModules = [
  'src/base.js',
  'src/currentScript.js',
  'src/importsLoaded.js'
];

var modules = [
  '../WeakMap/WeakMap.js',
  '../MutationObservers/MutationObserver.js',
  'src/path.js',
  'src/xhr.js',
  'src/Loader.js',
  'src/Observer.js',
  'src/parser.js',
  'src/importer.js',
  'src/boot.js'
];

var src = document.querySelector('script[src*="' + thisFile +
    '"]').attributes.src.value;
var basePath = src.slice(0, src.indexOf(thisFile));

function loadFiles(files) {
  files.forEach(function(f) {
    document.write('<script src="' + basePath + f + '"></script>');
  });
}

// for simplicity, we directly check here if native imports is supported.
var useNative = ('import' in document.createElement('link'));

loadFiles(baseModules);
if (!useNative) {
  loadFiles(modules);
}

})();
