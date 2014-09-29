/*
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */
/*
	Create polyfill scope and feature detect native support.
*/
window.HTMLImports = window.HTMLImports || {flags:{}};

(function(scope) {

// exports
scope.IMPORT_LINK_TYPE = 'import';
scope.hasNative = (scope.IMPORT_LINK_TYPE in document.createElement('link'));
scope.useNative = scope.hasNative;

})(HTMLImports);