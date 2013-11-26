/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

(function(scope) {

var IMPORT_LINK_TYPE = 'import';

// highlander object for parsing a document tree

var importParser = {
  selectors: [
    'link[rel=' + IMPORT_LINK_TYPE + ']',
    'link[rel=stylesheet]',
    'style',
    'script:not([type])',
    'script[type="text/javascript"]'
  ],
  map: {
    link: 'parseLink',
    script: 'parseScript',
    style: 'parseGeneric'
  },
  // TODO(sorvell): because dynamic imports are not supported, users are 
  // writing code like in https://github.com/Polymer/HTMLImports/issues/40
  // as a workaround. The code here checking for the existence of
  // document.scripts is here only to support the workaround.
  parse: function(document) {
    if (!document.__importParsed) {
      // only parse once
      document.__importParsed = true;
      // all parsable elements in inDocument (depth-first pre-order traversal)
      var elts = document.querySelectorAll(importParser.selectors);
      // memoize the number of scripts
      var scriptCount = document.scripts ? document.scripts.length : 0;
      // for each parsable node type, call the mapped parsing method
      for (var i=0, e; i<elts.length && (e=elts[i]); i++) {
        importParser[importParser.map[e.localName]](e);
        // if a script was injected, we need to requery our nodes
        // TODO(sjmiles): injecting nodes above the current script will
        // result in errors
        if (document.scripts && scriptCount !== document.scripts.length) {
          // memoize the new count
          scriptCount = document.scripts.length;
          // ensure we have any new nodes in our list
          elts = document.querySelectorAll(importParser.selectors);
        }
      }
    }
  },
  parseLink: function(linkElt) {
    if (isDocumentLink(linkElt)) {
      if (linkElt.import) {
        importParser.parse(linkElt.import);
        // fire load event
        linkElt.dispatchEvent(new CustomEvent('load'));
      }
    } else {
      this.parseGeneric(linkElt);
    }
  },
  parseGeneric: function(elt) {
    if (needsMainDocumentContext(elt)) {
      document.head.appendChild(elt);
    }
  },
  parseScript: function(scriptElt) {
    if (needsMainDocumentContext(scriptElt)) {
      // acquire code to execute
      var code = (scriptElt.__resource || scriptElt.textContent).trim();
      if (code) {
        // calculate source map hint
        var moniker = scriptElt.__nodeUrl;
        if (!moniker) {
          var moniker = scope.path.documentUrlFromNode(scriptElt);
          // there could be more than one script this url
          var tag = '[' + Math.floor((Math.random()+1)*1000) + ']';
          // TODO(sjmiles): Polymer hack, should be pluggable if we need to allow 
          // this sort of thing
          var matches = code.match(/Polymer\(['"]([^'"]*)/);
          tag = matches && matches[1] || tag;
          // tag the moniker
          moniker += '/' + tag + '.js';
        }
        // source map hint
        code += "\n//# sourceURL=" + moniker + "\n";
        // evaluate the code
        scope.currentScript = scriptElt;
        eval.call(window, code);
        scope.currentScript = null;
      }
    }
  }
};

var forEach = Array.prototype.forEach.call.bind(Array.prototype.forEach);

function isDocumentLink(elt) {
  return elt.localName === 'link'
      && elt.getAttribute('rel') === IMPORT_LINK_TYPE;
}

function needsMainDocumentContext(node) {
  // nodes can be moved to the main document:
  // if they are in a tree but not in the main document and not children of <element>
  return node.parentNode && !inMainDocument(node) 
      && !isElementElementChild(node);
}

function inMainDocument(elt) {
  return elt.ownerDocument === document ||
    // TODO(sjmiles): ShadowDOMPolyfill intrusion
    elt.ownerDocument.impl === document;
}

function isElementElementChild(elt) {
  return elt.parentNode && elt.parentNode.localName === 'element';
}

// exports

scope.parser = importParser;

})(HTMLImports);