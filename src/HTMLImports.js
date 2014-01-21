/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

(function(scope) {

var hasNative = ('import' in document.createElement('link'));
var useNative = !scope.flags.imports && hasNative;

var IMPORT_LINK_TYPE = 'import';

if (!useNative) {
  // imports
  var xhr = scope.xhr;

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
  var Loader = scope.Loader;
  var parser = scope.parser;

  var importer = {
    documents: {},
    preloadSelectors: [
      'link[rel=' + IMPORT_LINK_TYPE + ']',
      'template',
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
      var nodes = parent.querySelectorAll(importer.preloadSelectors);
      // from the main document, only load imports
      // TODO(sjmiles): do this by altering the selector list instead
      nodes = this.filterMainDocumentNodes(parent, nodes);
      // extra link nodes from templates, filter templates out of the nodes list
      nodes = this.extractTemplateNodes(nodes);
      return nodes;
    },
    filterMainDocumentNodes: function(parent, nodes) {
      var doc = parent.ownerDocument || parent;
      if (doc === document) {
        nodes = Array.prototype.filter.call(nodes, function(n) {
          return !isScript(n);
        });
      }
      return nodes;
    },
    extractTemplateNodes: function(nodes) {
      var extra = [];
      nodes = Array.prototype.filter.call(nodes, function(n) {
        if (n.localName === 'template') {
          if (n.content) {
            var l$ = n.content.querySelectorAll('link[rel=' + STYLE_LINK_TYPE +
              ']');
            if (l$.length) {
              extra = extra.concat(Array.prototype.slice.call(l$, 0));
            }
          }
          return false;
        }
        return true;
      });
      if (extra.length) {
        nodes = nodes.concat(extra);
      }
      return nodes;
    },
    loaded: function(url, elt, resource) {
      //console.log('loaded', url, elt);
      // store generic resource
      // TODO(sorvell): fails for nodes inside <template>.content
      // see https://code.google.com/p/chromium/issues/detail?id=249381.
      elt.__resource = resource;
      if (isDocumentLink(elt)) {
        var doc = importer.documents[url];
        // if we've never seen a document at this url
        if (!doc) {
          // generate an HTMLDocument from data
          doc = makeDocument(resource, url);
          // TODO(sorvell): we cannot use MO to detect parsed nodes because
          // SD polyfill does not report these as mutations.
          importer.loadSubtree(doc);
          importer.observe(doc);
          // cache document
          importer.documents[url] = doc;
        }
        elt.__resource = doc;
      }
      parser.parseNext();
    },
    errored: function(url, elt) {
      elt.__resource = null;
      parser.parseNext();
    },
    loadedAll: function() {
      parser.parseNext();
    }
  };

  var importLoader = new Loader(importer.loaded, importer.errored,
      importer.loadedAll);

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
    //base.setAttribute('href', document.baseURI || document.URL);
    base.setAttribute('href', url);
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

  // exports
  scope.importer = importer;
} else {
  // do nothing if using native imports
}

// NOTE: We cannot polyfill document.currentScript because it's not possible
// both to override and maintain the ability to capture the native value;
// therefore we choose to expose _currentScript both when native imports
// and the polyfill are in use.
Object.defineProperty(document, '_currentScript', {
  get: function() {
    return HTMLImports.currentScript || document.currentScript;
  },
  writeable: true,
  configurable: true
});

// TODO(sorvell): multiple calls will install multiple event listeners
// which may not be desireable; calls should resolve in the correct order,
// however.
function whenImportsReady(callback, doc) {
  doc = doc || document;
  // if document is loading, wait and try again
  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', function() {
      whenImportsReady(callback, doc);
    })
    return;
  }
  var imports = doc.querySelectorAll('link[rel=import');
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
      }
    }
  } else {
    checkDone();
  }
}

function isImportLoaded(link) {
  return link.import && (link.import.readyState !== 'loading');
}

// exports
scope.hasNative = hasNative;
scope.useNative = useNative;
scope.whenImportsReady = whenImportsReady;
scope.IMPORT_LINK_TYPE = IMPORT_LINK_TYPE;
scope.isImportLoaded = isImportLoaded;

})(window.HTMLImports);
