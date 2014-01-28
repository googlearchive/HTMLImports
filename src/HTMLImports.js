/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

(function(scope) {

var hasNative = ('import' in document.createElement('link'));
var flags = scope.flags;
var useNative = !flags.imports && hasNative;

var IMPORT_LINK_TYPE = 'import';

if (!useNative) {
  // imports
  var xhr = scope.xhr;
  var Loader = scope.Loader;
  var parser = scope.parser;
  // importer
  // highlander object represents a primary document (the argument to 'load')
  // at the root of a tree of documents

  // for any document, importer:
  // - loads any linked documents (with deduping), modifies paths and feeds them back into importer
  // - loads text of external script tags
  // - loads text of external style tags inside of <element>, modifies paths

  // when importer 'modifies paths' in a document, this includes
  // - href/src/action in node attributes
  // - paths in inline stylesheets
  // - all content inside templates

  // linked style sheets in an import have their own path fixed up when their containing import modifies paths
  // linked style sheets in an <element> are loaded, and the content gets path fixups
  // inline style sheets get path fixups when their containing import modifies paths

  var STYLE_LINK_TYPE = 'stylesheet';
  // TODO(sorvell): SD polyfill intrusion
  var mainDoc = window.ShadowDOMPolyfill ? 
    window.ShadowDOMPolyfill.wrapIfNeeded(document) : document;

  var importer = {
    documents: {},
    documentPreloadSelectors: 'link[rel=' + IMPORT_LINK_TYPE + ']',
    importsPreloadSelectors: [
        'link[rel=' + IMPORT_LINK_TYPE + ']',
        'script[src]:not([type])',
        'script[src][type="text/javascript"]'
    ].join(','),
    loadNode: function(node) {
      importLoader.addNode(node);
    },
    loadSubtree: function(parent) {
      var nodes = this.marshalNodes(parent);
      // add these nodes to loader's queue
      importLoader.addNodes(nodes);
    },
    marshalNodes: function(parent) {
      // all preloadable nodes in inDocument
      return parent.querySelectorAll(this.loadSelectorsForNode(parent));
    },
    loadSelectorsForNode: function(node) {
      var doc = node.ownerDocument || node;
      return doc === mainDoc ? this.documentPreloadSelectors :
          this.importsPreloadSelectors;
    },
    loaded: function(url, elt, resource) {
      flags.load && console.log('loaded', url, elt);
      // store generic resource
      // TODO(sorvell): fails for nodes inside <template>.content
      // see https://code.google.com/p/chromium/issues/detail?id=249381.
      elt.__resource = resource;
      if (isDocumentLink(elt)) {
        var doc = this.documents[url];
        // if we've never seen a document at this url
        if (!doc) {
          // generate an HTMLDocument from data
          doc = makeDocument(resource, url);
          doc.__importLink = elt;
          // TODO(sorvell): we cannot use MO to detect parsed nodes because
          // SD polyfill does not report these as mutations.
          this.bootDocument(doc);
          // cache document
          this.documents[url] = doc;
        }
        // don't store import record until we're actually loaded
        // store document resource
        elt.import = doc;
      }
      parser.parseNext();
    },
    bootDocument: function(doc) {
      this.loadSubtree(doc);
      this.observe(doc);
      parser.parseNext();
    },
    loadedAll: function() {
      parser.parseNext();
    }
  };

  var importLoader = new Loader(importer.loaded.bind(importer), 
      importer.loadedAll.bind(importer));

  function isDocumentLink(elt) {
    return isLinkRel(elt, IMPORT_LINK_TYPE);
  }

  function isStylesheetLink(elt) {
    return isLinkRel(elt, STYLE_LINK_TYPE);
  }

  function isLinkRel(elt, rel) {
    return elt.localName === 'link' && elt.getAttribute('rel') === rel;
  }

  function isScript(elt) {
    return elt.localName === 'script';
  }

  function makeDocument(resource, url) {
    // create a new HTML document
    var doc = resource;
    if (!(doc instanceof Document)) {
      doc = document.implementation.createHTMLDocument(IMPORT_LINK_TYPE);
    }
    // cache the new document's source url
    doc._URL = url;
    // establish a relative path via <base>
    var base = doc.createElement('base');
    base.setAttribute('href', url);
    // add baseURI support to browsers (IE) that lack it.
    if (!doc.baseURI) {
      doc.baseURI = url;
    }
    doc.head.appendChild(base);
    // install HTML last as it may trigger CustomElement upgrades
    // TODO(sjmiles): problem wrt to template boostrapping below,
    // template bootstrapping must (?) come before element upgrade
    // but we cannot bootstrap templates until they are in a document
    // which is too late
    if (!(resource instanceof Document)) {
      // install html
      doc.body.innerHTML = resource;
    }
    // TODO(sorvell): ideally this code is not aware of Template polyfill,
    // but for now the polyfill needs help to bootstrap these templates
    if (window.HTMLTemplateElement && HTMLTemplateElement.bootstrap) {
      HTMLTemplateElement.bootstrap(doc);
    }
    return doc;
  }
} else {
  // do nothing if using native imports
  var importer = {};
}

// NOTE: We cannot polyfill document.currentScript because it's not possible
// both to override and maintain the ability to capture the native value;
// therefore we choose to expose _currentScript both when native imports
// and the polyfill are in use.
Object.defineProperty(mainDoc, '_currentScript', {
  get: function() {
    return HTMLImports.currentScript || mainDoc.currentScript;
  },
  writeable: true,
  configurable: true
});

// TODO(sorvell): multiple calls will install multiple event listeners
// which may not be desireable; calls should resolve in the correct order,
// however.
function whenImportsReady(callback, doc) {
  doc = doc || mainDoc;
  // if document is loading, wait and try again
  var requiredState = HTMLImports.isIE ? 'complete' : 'interactive';
  var isReady = (doc.readyState === 'complete' ||
      doc.readyState === requiredState);
  if (!isReady) {
    var checkReady = function(e) {
      if (doc.readyState === 'complete' || doc.readyState === requiredState) {
        doc.removeEventListener('readystatechange', checkReady)
        whenImportsReady(callback, doc);
      }
    }
    doc.addEventListener('readystatechange', checkReady)
    return;
  }
  var imports = doc.querySelectorAll('link[rel=import]');
  var loaded = 0, l = imports.length;
  function checkDone(d) { 
    if (loaded == l) {
      // go async to ensure parser isn't stuck on a script tag
      requestAnimationFrame(callback);
    }
  }
  // called in context of import
  function loadedImport() {
    loaded++;
    checkDone();
  }
  if (l) {
    for (var i=0, imp; (i<l) && (imp=imports[i]); i++) {
      if (isImportLoaded(imp)) {
        loadedImport.call(imp);
      } else {
        imp.addEventListener('load', loadedImport);
        imp.addEventListener('error', loadedImport);
      }
    }
  } else {
    checkDone();
  }
}

function isImportLoaded(link) {
  return useNative ? (link.import && (link.import.readyState !== 'loading')) :
      link.__importParsed;
}

// exports
scope.hasNative = hasNative;
scope.useNative = useNative;
scope.importer = importer;
scope.whenImportsReady = whenImportsReady;
scope.IMPORT_LINK_TYPE = IMPORT_LINK_TYPE;
scope.isImportLoaded = isImportLoaded;
scope.importLoader = importLoader;

})(window.HTMLImports);
