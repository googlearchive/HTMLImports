/*
 * Copyright 2013 The Toolkitchen Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

(function() {

var IMPORT_LINK_TYPE = 'import';

// highlander object represents a primary document (the argument to 'parse')
// at the root of a tree of documents

var HTMLImports = {
  preloadSelectors: [
    'link[rel=' + IMPORT_LINK_TYPE + ']',
    'script[src]',
    'link[rel=stylesheet]'
  ],
  preload: function(inDocument, inNext) {
    // alias the loader cache
    hi.cache = loader.cache;
    // all preloadable nodes in inDocument
    var nodes = inDocument.querySelectorAll(hi.preloadSelectors);
    // filter out scripts in the main document
    // TODO(sjmiles): do this by altering the selector list instead
    nodes = Array.prototype.filter.call(nodes, function(n) {
      return isDocumentLink(n) || !inMainDocument(n);
    });
    // preload all nodes, call inNext when complete, call hi.eachPreload
    // for each preloaded node
    loader.loadAll(nodes, inNext, hi.eachPreload);
  },
  eachPreload: function(data, next, url, elt) {
    // for document links
    if (isDocumentLink(elt)) {
      // generate an HTMLDocument from data
      var document = makeDocument(data, url);
      // resolve resource paths relative to host document
      path.resolveHTML(document);
      // store document resource
      elt.content = elt.__resource = loader.cache[url] = document;
      // re-enters preloader here
      HTMLImports.preload(document, next);
    } else  {
      // resolve stylesheet resource paths relative to host document
      if (isStylesheetLink(elt)) {
        path.resolveSheet(elt);
      }
      // no preprocessing on other nodes
      next();
    }
  }
};

var hi = HTMLImports;
hi.preloadSelectors = hi.preloadSelectors.join(',');

function isDocumentLink(inElt) {
  return isLinkRel(inElt, IMPORT_LINK_TYPE);
}

function isStylesheetLink(inElt) {
  return isLinkRel(inElt, 'stylesheet');
}

function isLinkRel(inElt, inRel) {
  return (inElt.localName === 'link' 
      && inElt.getAttribute('rel') === inRel);
}

function inMainDocument(inElt) {
  return inElt.ownerDocument === document ||
    // TODO(sjmiles): ShadowDOMPolyfill intrusion
    inElt.ownerDocument.impl === document;
}

function makeDocument(inHTML, inUrl) {
  // create a new HTML document
  var doc = document.implementation.createHTMLDocument(IMPORT_LINK_TYPE);
  // cache the new document's source url
  doc._URL = inUrl;
  // establish a relative path via <base>
  var base = doc.createElement('base'); 
  base.setAttribute('href', document.baseURI); 
  // TODO(sjmiles): ShadowDOMPolyfill intrusion
  if (window.ShadowDOMPolyfill) {
    base = ShadowDOMPolyfill.unwrap(base);
  }
  doc.head.appendChild(base);
  // install html
  doc.body.innerHTML = inHTML;
  return doc;
}

var loader = {
  cache: {},
  loadAll: function(inNodes, inNext, inEach) {
    // something to do?
    if (!inNodes.length) {
      inNext();
    }
    // begin async load of resource described by inElt
    // 'each' and 'tail' are possible continuations
    function head(inElt) {
      var url = path.nodeUrl(inElt);
      inElt.__nodeUrl = url;
      var resource = loader.cache[url];
      if (resource) {
        inElt.__resource = resource;
        tail();
      } else {
        xhr.load(url, function(err, resource, url) {
          if (err) {
            tail();
          } else {
            inElt.__resource = loader.cache[url] = resource;
            each(resource, tail, url, inElt);
          }
        });
      }
    }
    // when a resource load is complete, decrement the count
    // of inflight loads and process the next one
    function tail() {
      if (!--inflight) {
        inNext();
      }
    }
    // inEach function is optional 'before' advice for tail
    // inEach must call it's 'next' argument
    var each = inEach || tail;
    // number of transactions to complete
    var inflight = inNodes.length;
    // begin async loading
    forEach(inNodes, head);
  }
};

var path = {
  nodeUrl: function(inNode) {
    return path.resolveNodeUrl(inNode, path.hrefOrSrc(inNode));
  },
  hrefOrSrc: function(inNode) {
    return inNode.getAttribute("href") || inNode.getAttribute("src");
  },
  resolveNodeUrl: function(inNode, inRelativeUrl) {
    return this.resolveUrl(this.documentUrlFromNode(inNode), inRelativeUrl);
  },
  documentUrlFromNode: function(inNode) {
    var url = path.getDocumentUrl(inNode.ownerDocument);
    // take only the left side if there is a #
    url = url.split('#')[0];
    return url;
  },
  getDocumentUrl: function(inDocument) {
    return inDocument && 
        // TODO(sjmiles): ShadowDOMPolyfill intrusion
        (inDocument._URL || (inDocument.impl && inDocument.impl._URL)
            || inDocument.URL)
                || '';
  },
  resolveUrl: function(inBaseUrl, inUrl) {
    if (this.isAbsUrl(inUrl)) {
      return inUrl;
    }
    return this.compressUrl(this.urlToPath(inBaseUrl) + inUrl);
  },
  isAbsUrl: function(inUrl) {
    return /(^data:)|(^http[s]?:)|(^\/)/.test(inUrl);
  },
  urlToPath: function(inBaseUrl) {
    var parts = inBaseUrl.split("/");
    parts.pop();
    parts.push('');
    return parts.join("/");
  },
  compressUrl: function(inUrl) {
    var parts = inUrl.split("/");
    for (var i=0, p; i<parts.length; i++) {
      p = parts[i];
      if (p === "..") {
        parts.splice(i-1, 2);
        i -= 2;
      }
    }
    return parts.join("/");
  },
  resolveHTML: function(inRoot) {
    var docUrl = path.documentUrlFromNode(inRoot.body);
    path._resolveHTML(inRoot.body, docUrl);
  },
  _resolveHTML: function(inRoot, inUrl) {
    path.resolveAttributes(inRoot, inUrl);
    path.resolveStyleElts(inRoot, inUrl);
    // handle templates, if supported
    if (window.templateContent) {
      var templates = inRoot.querySelectorAll('template');
      if (templates) {
        forEach(templates, function(t) {
          // TODO(sjmiles): ShadowDOMPolyfill intrusion
          if (window.ShadowDOMPolyfill && !t.impl) {
            t = ShadowDOMPolyfill.wrap(t);
          } 
          path._resolveHTML(templateContent(t), inUrl);
        });
      }
    }
  },
  resolveSheet: function(inSheet) {
    var docUrl = path.nodeUrl(inSheet);
    inSheet.__resource = path.resolveCssText(inSheet.__resource, docUrl);
  },
  resolveStyleElts: function(inRoot, inUrl) {
    var styles = inRoot.querySelectorAll('style');
    if (styles) {
      forEach(styles, function(style) {
        style.textContent = path.resolveCssText(style.textContent, inUrl);
      });
    }
  },
  resolveCssText: function(inCssText, inBaseUrl) {
    return inCssText.replace(/url\([^)]*\)/g, function(inMatch) {
      // find the url path, ignore quotes in url string
      var urlPath = inMatch.replace(/["']/g, "").slice(4, -1);
      urlPath = path.resolveUrl(inBaseUrl, urlPath);
      return "url(" + urlPath + ")";
    });
  },
  resolveAttributes: function(inRoot, inUrl) {
    // search for attributes that host urls
    var nodes = inRoot && inRoot.querySelectorAll(URL_ATTRS_SELECTOR);
    if (nodes) {
      forEach(nodes, function(n) {
        URL_ATTRS.forEach(function(v) {
          var attr = n.attributes[v];
          if (attr && attr.value && 
             (attr.value.search(URL_TEMPLATE_SEARCH) < 0)) {
            attr.value = path.resolveUrl(inUrl, attr.value);
          }
        });
      });
    }
  }
}

var URL_ATTRS = ['href', 'src', 'action'];
var URL_ATTRS_SELECTOR = ':not(link)[' + URL_ATTRS.join('],[') + ']';
var URL_TEMPLATE_SEARCH = '{{.*}}';

var xhr = {
  async: true,
  ok: function(inRequest) {
    return (inRequest.status >= 200 && inRequest.status < 300)
        || (inRequest.status === 304);
  },
  load: function(url, next, nextContext) {
    var request = new XMLHttpRequest();
    request.open('GET', url + '?' + Math.random(), xhr.async);
    request.addEventListener('readystatechange', function(e) {
      if (request.readyState === 4) {
        next.call(nextContext, !xhr.ok(request) && request,
          request.response, url);
      }
    });
    request.send();
  }
};

var forEach = Array.prototype.forEach.call.bind(Array.prototype.forEach);

// exports

window.HTMLImports = HTMLImports;

// bootstrap

// IE shim for CustomEvent
if (typeof window.CustomEvent !== 'function') {
  window.CustomEvent = function(inType) {
     var e = document.createEvent('HTMLEvents');
     e.initEvent(inType, true, true);
     return e;
  };
}

// TODO(sjmiles): https://github.com/toolkitchen/ShadowDOM/issues/76
var ael = window.addEventListener_ || window.addEventListener;

ael.call(window, 'load', function() {
  // preload document resource trees
  HTMLImports.preload(document, function() {
    // TODO(sjmiles): ShadowDOM polyfill pollution
    var doc = window.ShadowDOMPolyfill ? ShadowDOMPolyfill.wrap(document) 
        : document;
    // send HTMLImportsLoaded when finished
    doc.body.dispatchEvent(
      new CustomEvent('HTMLImportsLoaded', {bubbles: true})
    );
  });
});

})();
