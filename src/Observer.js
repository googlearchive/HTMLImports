 /*
Copyright 2013 The Polymer Authors. All rights reserved.
Use of this source code is governed by a BSD-style
license that can be found in the LICENSE file.
*/

(function(scope){

var IMPORT_LINK_TYPE = scope.IMPORT_LINK_TYPE;
var importSelector = 'link[rel=' + IMPORT_LINK_TYPE + ']';
var importer = scope.importer;

// we track mutations for addedNodes, looking for imports
function handler(mutations) {
  for (var i=0, l=mutations.length, m; (i<l) && (m=mutations[i]); i++) {
    if (m.type === 'childList' && m.addedNodes.length) {
      addedNodes(m.addedNodes);
    }
  }
}

// find loadable elements and add them to the importer
function addedNodes(nodes) {
  for (var i=0, l=nodes.length, n; (i<l) && (n=nodes[i]); i++) {
    if (shouldLoadNode(n)) {
      importer.loadNode(n);
    }
    if (n.children && n.children.length) {
      addedNodes(n.children);
    }
  }
}

function shouldLoadNode(node) {
  return (node.nodeType === 1) && matches.call(node,
      importer.loadSelectorsForNode(node));
}

// x-plat matches
var matches = HTMLElement.prototype.matches || 
    HTMLElement.prototype.matchesSelector || 
    HTMLElement.prototype.webkitMatchesSelector ||
    HTMLElement.prototype.mozMatchesSelector ||
    HTMLElement.prototype.oMatchesSelector ||
    HTMLElement.prototype.msMatchesSelector;

var observer = new MutationObserver(handler);

// observe the given root for loadable elements
function observe(root) {
  observer.observe(root, {childList: true, subtree: true});
}

// exports
// TODO(sorvell): factor so can put on scope
scope.observe = observe;
importer.observe = observe;

})(HTMLImports);
