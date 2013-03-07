/*
 * Copyright 2013 The Toolkitchen Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

(function() {
  
// highlander object represents a primary document (the argument to 'parse')
// at the root of a tree of documents

var HTMLComponents = {
  preloadSelectors: [
    'link[rel=component]',
    'script[src]',
    'link[rel=stylesheet]'
  ],
  preload: function(inDocument, inNext) {
    // alias the loader cache in HTMLComponents
    hc.cache = loader.cache;
    // all preloadable nodes in inDocument
    var nodes = inDocument.querySelectorAll(hc.preloadSelectors);
    // preload all nodes, call inNext when complete, call hc.eachPreload
    // for each preloaded node
    loader.loadAll(nodes, inNext, hc.eachPreload);
  },
  eachPreload: function(data, next, url, elt) {
    // for document links
    if (hc.isDocumentLink(elt)) {
      // generate an HTMLDocument from data
      var document = makeDocument(data, url);
      // store document resource
      document.__resource = loader.cache[url] = makeDocument(data, url);
      // re-enters preloader here
      HTMLComponents.preload(document, next);
    } else {
      // no preprocessing on other nodes
      next();
    }
  },
  isDocumentLink: function(inElt) {
    return (inElt.localName === 'link' 
        && inElt.getAttribute('rel') === 'component');
  }
};

var hc = HTMLComponents;
hc.preloadSelectors = hc.preloadSelectors.join(',');

var makeDocument = function(inHTML, inUrl) {
  var doc = document.implementation.createHTMLDocument('component');
  doc.body.innerHTML = inHTML;
  doc._URL = inUrl;
  return doc;
};

loader = {
  cache: {},
  loadAll: function(inNodes, inNext, inEach) {
    // something to do?
    if (!inNodes.length) {
      inNext();
    }
    // no transactions yet
    var inflight = 0;
    // begin async load of resource described by inElt
    // 'each' and 'tail' are possible continuations
    function head(inElt) {
      inflight++;
      var url = path.nodeUrl(inElt);
      var resource = loader.cache[url];
      if (resource) {
        inElt.__resource = resource;
        tail();
      }
      xhr.load(url, function(err, resource, url) {
        if (err) {
          tail();
        } else {
          inElt.__resource = loader.cache[url] = resource;
          each(resource, tail, url, inElt);
        }
      });
    };
    // when a resource load is complete, decrement the count
    // of inflight loads and process the next one
    function tail() {
      if (!--inflight) {
        inNext();
      };
    };
    // inEach function is optional 'before' advice for tail
    // inEach must call it's 'next' argument
    var each = inEach || tail;
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
    var d = inNode.ownerDocument;
    var url = (d && (d._URL || d.URL)) || "";
    // take only the left side if there is a #
    url = url.split("#")[0];
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

var xhr = {
  async: true,
  ok: function(inRequest) {
    return (inRequest.status >= 200 && inRequest.status < 300)
        || (inRequest.status === 304);
  },
  load: function(url, next, nextContext) {
    var request = new XMLHttpRequest();
    request.open('GET', url, xhr.async);
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

window.HTMLComponents = HTMLComponents;
  
})();
