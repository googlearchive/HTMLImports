/*
 * Copyright 2013 The Toolkitchen Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

(function() {
  
// highlander object represents a primary document (the argument to 'parse')
// at the root of a tree of documents

var WebComponents = {
  preloadSelectors: [
    'link[rel=component]',
    'script[src]',
    'link[rel=stylesheet]'
  ],
  preload: function(inDocument, inNext) {
    // alias the loader cache in WebComponents
    wc.cache = loader.cache;
    // all preloadable nodes in inDocument
    var nodes = inDocument.querySelectorAll(wc.preloadSelectors);
    // filter out scripts in the main document
    // TODO(sjmiles): do this by altering the selector list instead
    nodes = Array.prototype.filter.call(nodes, function(n) {
      return isDocumentLink(n) || !inMainDocument(n);
    });
    // preload all nodes, call inNext when complete, call wc.eachPreload
    // for each preloaded node
    loader.loadAll(nodes, inNext, wc.eachPreload);
  },
  eachPreload: function(data, next, url, elt) {
    // for document links
    if (isDocumentLink(elt)) {
      // generate an HTMLDocument from data
      var document = makeDocument(data, url);
      // resolve resource paths relative to host document
      pathResolver.resolve(document);
      // store document resource
      elt.component = elt.__resource = loader.cache[url] = document;
      // re-enters preloader here
      WebComponents.preload(document, next);
    } else  {
      // resolve stylesheet resource paths relative to host document
      if (isStylesheetLink(elt)) {
        pathResolver.resolveSheet(elt);
      }
      // no preprocessing on other nodes
      next();
    }
  },
  getDocumentUrl: function(inDocument) {
    return inDocument &&
        // TODO(sjmiles): ShadowDOMPolyfill intrusion
        (inDocument._URL || (inDocument.impl && inDocument.impl._URL)
            || inDocument.URL)
                || '';
  }
};

var wc = WebComponents;

wc.preloadSelectors = wc.preloadSelectors.join(',');

function isDocumentLink(inElt) {
  return (inElt.localName === 'link'
      && inElt.getAttribute('rel') === 'component');
}

function isDocumentLink(inElt) {
  return wc.isLinkRel(inElt, 'component');
}

function isStylesheetLink(inElt) {
  return wc.isLinkRel(inElt, 'stylesheet');
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
  var doc = document.implementation.createHTMLDocument('component');
  doc.body.innerHTML = inHTML;
  doc._URL = inUrl;
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
    var url = wc.getDocumentUrl(inNode.ownerDocument);
    // take only the left side if there is a #
    url = url.split('#')[0];
    return url;
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
  }
};

// Path resolution helper to ensure resource paths are resolved correctly
var pathResolver = {
  resolve: function(inRoot) {
    var docUrl = path.documentUrlFromNode(inRoot.body);
    pathResolver._resolve(inRoot.body, docUrl);
  },
  _resolve: function(inRoot, inUrl) {
    pathResolver.resolveAttributes(inRoot, inUrl);
    pathResolver.resolveStyleElts(inRoot, inUrl);
    // handle templates, if supported
    if (window.templateContent) {
      var templates = inRoot.querySelectorAll('template');
      if (templates) {
        forEach(templates, function(t) {
          pathResolver._resolve(templateContent(t), inUrl);
        });
      }
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
  resolveSheet: function(inSheet) {
    var docUrl = path.nodeUrl(inSheet);
    inSheet.__resource = pathResolver.resolveCssText(inSheet.__resource, docUrl);
  },
  resolveStyleElts: function(inRoot, inUrl) {
    var styles = inRoot.querySelectorAll('style');
    if (styles) {
      forEach(styles, function(style) {
        style.textContent = pathResolver.resolveCssText(style.textContent, inUrl);
      });
    }
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

window.WebComponents = WebComponents;

// bootstrap

// IE shim for CustomEvent
if (typeof window.CustomEvent !== 'function') {
  window.CustomEvent = function(inType) {
     var e = document.createEvent('HTMLEvents');
     e.initEvent(inType, true, true);
     return e;
  };
}

window.addEventListener('load', function() {
  // preload document resource trees
  WebComponents.preload(document, function() {
    // TODO(sjmiles): ShadowDOM polyfill pollution
    var sdocument = window.wrap ? wrap(document) : document;
    // send WebComponentsLoaded when finished
    sdocument.body.dispatchEvent(
      new CustomEvent('WebComponentsLoaded', {bubbles: true})
    );
  });
});

})();
