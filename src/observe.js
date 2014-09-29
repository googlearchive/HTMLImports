/*
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */
(function(scope){

// imports
var importer = scope.importer;
var parser = scope.parser;

// we track mutations for addedNodes, looking for imports
function handler(mutations) {
  for (var i=0, l=mutations.length, m; (i<l) && (m=mutations[i]); i++) {
    if (m.type === 'childList' && m.addedNodes.length) {
      addedNodes(m.addedNodes);
    }
  }
}

// find loadable elements and add them to the importer
// IFF the owning document has already parsed, then parsable elements
// need to be marked for dynamic parsing.
function addedNodes(nodes) {
  var owner, parsed;
  for (var i=0, l=nodes.length, n, loading; (i<l) && (n=nodes[i]); i++) {
    if (!owner) {
      owner = n.ownerDocument;
      parsed = parser.isParsed(owner);
    }
    // note: the act of loading kicks the parser, so we use parseDynamic's
    // 2nd argument to control if this added node needs to kick the parser.
    loading = shouldLoadNode(n);
    if (loading) {
      importer.loadNode(n);
    }
    if (shouldParseNode(n) && parsed) {
      parser.parseDynamic(n, loading);
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

function shouldParseNode(node) {
  return (node.nodeType === 1) && matches.call(node,
      parser.parseSelectorsForNode(node));  
}

// x-plat matches
var matches = HTMLElement.prototype.matches || 
    HTMLElement.prototype.matchesSelector || 
    HTMLElement.prototype.webkitMatchesSelector ||
    HTMLElement.prototype.mozMatchesSelector ||
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
