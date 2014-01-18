 /*
Copyright 2013 The Polymer Authors. All rights reserved.
Use of this source code is governed by a BSD-style
license that can be found in the LICENSE file.
*/

(function(scope){

var IMPORT_LINK_TYPE = scope.IMPORT_LINK_TYPE;
var importSelector = 'link[rel=' + IMPORT_LINK_TYPE + ']';

var matches = HTMLElement.prototype.matches || 
    HTMLElement.prototype.matchesSelector || 
    HTMLElement.prototype.webkitMatchesSelector ||
    HTMLElement.prototype.mozMatchesSelector;

var importer = scope.importer;

function handler(mutations) {
  for (var i=0, l=mutations.length, m; (i<l) && (m=mutations[i]); i++) {
    if (m.type === 'childList' && m.addedNodes.length) {
      addedNodes(m.addedNodes);
    }
  });
};

function addedNodes(nodes) {
  for (var i=0, l=nodes.length, n; (i<l) && (n=nodes[i]); i++) {
    if (shouldLoadNode(n)) {
      // TODO(sorvell): need to add this api.
      importer.addNode(n);
      if (n.children && n.children.length) {
        addedNodes(n.children);
      }
    }
  }
}

function shouldLoadNode(node) {
  return matches.call(node, importer.preloadSelectors);
}

var observer = new MutationObserver(handler);

function observe(root) {
  observer.observe(root, {childList: true, subtree: true});
}

// *****
// TODO(sorvell): wip
function canParse(node) {
  var doc = node.ownerDocument;
  return nextImportToParse(doc) === node;
}

function nextImportToParse() {
  //doc.querySelectorAll(importSelector)
}


// exports
scope.observe = observe;

})(HTMLImports);
