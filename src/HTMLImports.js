/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

(function(scope) {

var hasNative = ('import' in document.createElement('link'));
var useNative = !scope.flags.imports && hasNative;

if (!useNative) {

  // imports
  var path = scope.path;
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

  var loader;
  var IMPORT_LINK_TYPE = 'import';
  var STYLE_LINK_TYPE = 'stylesheet';

  var importer = {
    documents: {},
    cache: {},
    preloadSelectors: [
      'link[rel=' + IMPORT_LINK_TYPE + ']',
      'template',
      'script[src]:not([type])',
      'script[src][type="text/javascript"]'
    ].join(','),
    loader: function(next) {
      if (loader && loader.inflight) {
        var currentComplete = loader.oncomplete;
        loader.oncomplete = function() {
          currentComplete();
          next();
        }
        return loader;
      }
      // construct a loader instance
      loader = new Loader(importer.loaded, next);
      // alias the importer cache (for debugging)
      loader.cache = importer.cache;
      return loader;
    },
    load: function(doc, next) {
      // get a loader instance from the factory
      loader = importer.loader(next);
      // add nodes from document into loader queue
      importer.preload(doc);
    },
    preload: function(doc) {
      var nodes = this.marshalNodes(doc);
      // add these nodes to loader's queue
      loader.addNodes(nodes);
    },
    marshalNodes: function(doc) {
      // all preloadable nodes in inDocument
      var nodes = doc.querySelectorAll(importer.preloadSelectors);
      // from the main document, only load imports
      // TODO(sjmiles): do this by altering the selector list instead
      nodes = this.filterMainDocumentNodes(doc, nodes);
      // extra link nodes from templates, filter templates out of the nodes list
      nodes = this.extractTemplateNodes(nodes);
      return nodes;
    },
    filterMainDocumentNodes: function(doc, nodes) {
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
      if (isDocumentLink(elt)) {
        var document = importer.documents[url];
        // if we've never seen a document at this url
        if (!document) {
          // generate an HTMLDocument from data
          document = makeDocument(resource, url);
          // resolve resource paths relative to host document
          //path.resolvePathsInHTML(document);
          // cache document
          importer.documents[url] = document;
          // add nodes from this document to the loader queue
          importer.preload(document);
        }
        // store import record
        elt.import = document;
        elt.import.href = url;
        elt.import.ownerNode = elt;
        // store document resource
        elt.content = resource = document;
      }
      // store generic resource
      // TODO(sorvell): fails for nodes inside <template>.content
      // see https://code.google.com/p/chromium/issues/detail?id=249381.
      elt.__resource = resource;
      // css path fixups
      if (isStylesheetLink(elt)) {
        path.resolvePathsInStylesheet(elt);
      }
    }
  };

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

  var Loader = function(onLoad, onComplete) {
    this.onload = onLoad;
    this.oncomplete = onComplete;
    this.inflight = 0;
    this.pending = {};
    this.cache = {};
  };

  Loader.prototype = {
    addNodes: function(nodes) {
      // number of transactions to complete
      this.inflight += nodes.length;
      // commence transactions
      forEach(nodes, this.require, this);
      // anything to do?
      this.checkDone();
    },
    require: function(elt) {
      var url = path.nodeUrl(elt);
      // ensure we have a standard url that can be used
      // reliably for deduping.
      url = path.makeAbsUrl(url);
      // TODO(sjmiles): ad-hoc
      elt.__nodeUrl = url;
      // deduplication
      if (!this.dedupe(url, elt)) {
        // fetch this resource
        this.fetch(url, elt);
      }
    },
    dedupe: function(url, elt) {
      if (this.pending[url]) {
        // add to list of nodes waiting for inUrl
        this.pending[url].push(elt);
        // don't need fetch
        return true;
      }
      if (this.cache[url]) {
        // complete load using cache data
        this.onload(url, elt, loader.cache[url]);
        // finished this transaction
        this.tail();
        // don't need fetch
        return true;
      }
      // first node waiting for inUrl
      this.pending[url] = [elt];
      // need fetch (not a dupe)
      return false;
    },
    fetch: function(url, elt) {
      var receiveXhr = function(err, resource) {
        this.receive(url, elt, err, resource);
      }.bind(this);
      xhr.load(url, receiveXhr);
      // TODO(sorvell): blocked on
      // https://code.google.com/p/chromium/issues/detail?id=257221
      // xhr'ing for a document makes scripts in imports runnable; otherwise
      // they are not; however, it requires that we have doctype=html in
      // the import which is unacceptable. This is only needed on Chrome
      // to avoid the bug above.
      /*
      if (isDocumentLink(elt)) {
        xhr.loadDocument(url, receiveXhr);
      } else {
        xhr.load(url, receiveXhr);
      }
      */
    },
    receive: function(url, elt, err, resource) {
      if (!err) {
        loader.cache[url] = resource;
      }
      loader.pending[url].forEach(function(e) {
        if (!err) {
          this.onload(url, e, resource);
        }
        this.tail();
      }, this);
      loader.pending[url] = null;
    },
    tail: function() {
      --this.inflight;
      this.checkDone();
    },
    checkDone: function() {
      if (!this.inflight) {
        this.oncomplete();
      }
    }
  };

  xhr = xhr || {
    async: true,
    ok: function(request) {
      return (request.status >= 200 && request.status < 300)
          || (request.status === 304)
          || (request.status === 0);
    },
    load: function(url, next, nextContext) {
      var request = new XMLHttpRequest();
      if (scope.flags.debug || scope.flags.bust) {
        url += '?' + Math.random();
      }
      request.open('GET', url, xhr.async);
      request.addEventListener('readystatechange', function(e) {
        if (request.readyState === 4) {
          next.call(nextContext, !xhr.ok(request) && request,
              request.response || request.responseText, url);
        }
      });
      request.send();
      return request;
    },
    loadDocument: function(url, next, nextContext) {
      this.load(url, next, nextContext).responseType = 'document';
    }
  };

  var forEach = Array.prototype.forEach.call.bind(Array.prototype.forEach);

  // exports
  scope.xhr = xhr;
  scope.importer = importer;
  scope.IMPORT_LINK_TYPE = IMPORT_LINK_TYPE;
} else {
  // do nothing if using native imports
  /*
  // TODO(sorvell): this exists as a load extension point.
  importer.preloadSelectors = [
    'template'
  ].join(',');

  function forEachImport(imp, cb) {
    if (cb) {
      cb(imp);
    }
    var n$ = imp.querySelectorAll('link[rel=' + IMPORT_LINK_TYPE + ']');
    for (var i=0, l=n$.length, n; (i<l) && (n=n$[i]); i++) {
      if (n.import) {
        forEachImport(n.import, cb);
      } else {
        console.warn('import not loaded', n);
      }
    }
  };
  
  var marshalNodes = importer.marshalNodes;
  function preloadImport(imp) {
    nodes = marshalNodes.call(this, imp);
    var url = path.documentUrlFromNode(imp);
    for (var i=0, l=nodes.length, n; (i<l) && (n=nodes[i]); i++) {
      path.resolveNodeAttributes(n, url);  
    }
    return nodes; 
  };
  

  // marshal all relevant nodes in import tree.
  importer.marshalNodes = function(doc) {
    var nodes = [], self = this;
    forEachImport(doc, function(imp) {
      // only preload 1x per import.
      if (!imp._preloaded) {
        imp._preloaded = true;
        var n$ = preloadImport.call(self, imp);
        nodes = nodes.concat(Array.prototype.slice.call(n$, 0));
      }
    });
    return nodes;
  }
  */
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

// exports
scope.hasNative = hasNative;
scope.useNative = useNative;

})(window.HTMLImports);
