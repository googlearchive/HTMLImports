/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

(function(scope) {

var IMPORT_LINK_TYPE = 'import';
var isIe = /Trident/.test(navigator.userAgent)
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
    style: 'parseStyle'
  },
  parseNext: function() {
    var next = this.nextToParse();
    if (next) {
      this.parse(next);
    }
  },
  parse: function(elt) {
    if (elt.__importParsed) {
      console.log('[%s] is already parsed', elt.localName);
      return;
    }
    var fn = this[this.map[elt.localName]];
    if (fn) {
      this.markParsing(elt);
      fn.call(this, elt);
    }
  },
  markParsing: function(elt) {
    console.log('parsing', elt.localName, elt.href || elt.src);
    this.parsingElement = elt;
  },
  markParsingComplete: function(elt) {
    elt.__importParsed = true;
    if (elt.__importElement) {
      elt.__importElement.__importParsed = true;
    }
    this.parsingElement = null;
    this.parseNext();
  },
  parseImport: function(elt) {
    // TODO(sorvell): onerror
    // fire load event
    if (elt.__resource) {
      elt.dispatchEvent(new CustomEvent('load', {bubbles: false}));    
    } else {
      elt.dispatchEvent(new CustomEvent('error', {bubbles: false}));
    }
    // TODO(sorvell): workaround for Safari addEventListener not working
    // for elements not in the main document.
    if (linkElt.__pending) {
      var fn;
      while (linkElt.__pending.length) {
        fn = linkElt.__pending.shift();
        if (fn) {
          fn({target: linkElt});
        }
      }
    }
    this.markParsingComplete(elt);
  },
  parseLink: function(linkElt) {
    if (isDocumentLink(linkElt)) {
      this.parseImport(linkElt);
    } else {
      // make href relative to main document
      if (needsMainDocumentContext(linkElt)) {
        linkElt.href = linkElt.href;
      }
      this.parseGeneric(linkElt);
    }
  },
  parseStyle: function(elt) {
    // TODO(sorvell): style element load event can just not fire so clone styles
    var src = elt;
    elt = needsMainDocumentContext(elt) ? cloneStyle(elt) : elt;
    elt.__importElement = src;
    this.parseGeneric(elt);
  },
  parseGeneric: function(elt) {
    // TODO(sorvell): because of a style element needs to be out of 
    // tree to fire the load event, avoid the check for parentNode that
    // needsMainDocumentContext does. Why was that necessary? if it is, 
    // refactor this.
    //if (needsMainDocumentContext(elt)) {
    if (!inMainDocument(elt)) {
      this.trackElement(elt);
      document.head.appendChild(elt);
    }
  },
  trackElement: function(elt) {
    var self = this;
    var done = function() {
      self.markParsingComplete(elt);
    };
    elt.addEventListener('load', done);
    elt.addEventListener('error', done);
  },
  parseScript: function(scriptElt) {
    if (needsMainDocumentContext(scriptElt)) {
      // acquire code to execute
      var code = (scriptElt.__resource || scriptElt.textContent).trim();
      if (code) {
        // calculate source map hint
        var moniker = scriptElt.__nodeUrl;
        if (!moniker) {
          moniker = scriptElt.ownerDocument.baseURI;
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
    this.markParsingComplete();
  },
  nextToParse: function() {
    return !this.parsingElement && this.nextToParseInDoc(document);
  },
  nextToParseInDoc: function(doc) {
    var nodes = doc.querySelectorAll(this.selectors);
    for (var i=0, l=nodes.length, n; (i<l) && (n=nodes[i]); i++) {
      if (this.canParse(n)) {
        return nodeIsImport(n) ? this.nextToParseInDoc(n.__resource) || n : n;
      }
    }
  },
  canParse: function(node) {
    var parseable = !node.__importParsed;
    return parseable && this.hasResource(node);
  },
  hasResource: function(node) {
    return (!(nodeIsImport(node) || (node.localName === 'script')) ||
        node.__resource);
  }
};



// clone style with proper path resolution for main document
// NOTE: styles are the only elements that require direct path fixup.
function cloneStyle(style) {
  var clone = style.ownerDocument.createElement('style');
  clone.textContent = style.textContent;
  path.resolveUrlsInStyle(clone);
  return clone;
}

var CSS_URL_REGEXP = /(url\()([^)]*)(\))/g;
var CSS_IMPORT_REGEXP = /(@import[\s]*)([^;]*)(;)/g;

var path = {
  resolveUrlsInStyle: function(style) {
    var doc = style.ownerDocument;
    var resolver = doc.createElement('a');
    style.textContent = this.resolveUrlsInCssText(style.textContent, resolver);
    return style;  
  },
  resolveUrlsInCssText: function(cssText, urlObj) {
    var r = this.replaceUrls(cssText, urlObj, CSS_URL_REGEXP);
    r = this.replaceUrls(r, urlObj, CSS_IMPORT_REGEXP);
    return r;
  },
  replaceUrls: function(text, urlObj, regexp) {
    return text.replace(regexp, function(m, pre, url, post) {
      var urlPath = url.replace(/["']/g, '');
      urlObj.href = urlPath;
      urlPath = urlObj.href;
      return pre + '\'' + urlPath + '\'' + post;
    });    
  }
}

function nodeIsImport(elt) {
  return (elt.localName === 'link') && (elt.rel === 'import');
}

function isDocumentLink(elt) {
  return elt.localName === 'link'
      && elt.getAttribute('rel') === IMPORT_LINK_TYPE;
}

function needsMainDocumentContext(node) {
  // nodes can be moved to the main document:
  // if they are in a tree but not in the main document
  return node.parentNode && !inMainDocument(node);
}

function inMainDocument(elt) {
  return elt.ownerDocument === document ||
    // TODO(sjmiles): ShadowDOMPolyfill intrusion
    elt.ownerDocument.impl === document;
}

// exports
scope.parser = importParser;
scope.path = path;
scope.isIE = isIe;

})(HTMLImports);