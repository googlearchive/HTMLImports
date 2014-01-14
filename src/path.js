/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

(function(scope) {

var URL_ATTRS = ['href', 'src', 'action'];
var URL_ATTRS_SELECTOR = '[' + URL_ATTRS.join('],[') + ']';
var URL_TEMPLATE_SEARCH = '{{.*}}';
var CSS_URL_REGEXP = /(url\()([^)]*)(\))/g;
var CSS_IMPORT_REGEXP = /(@import[\s]*)([^;]*)(;)/g;

var path = {
  nodeUrl: function(node) {
    var docUrl = path.documentUrlFromNode(node);
    return path.resolveUrl(docUrl, path.hrefOrSrc(node));
    //return path.resolveUrl(path.documentURL, path.hrefOrSrc(node));
  },
  hrefOrSrc: function(node) {
    return node.getAttribute("href") || node.getAttribute("src");
  },
  documentUrlFromNode: function(node) {
    return path.getDocumentUrl(node.ownerDocument || node);
  },
  getDocumentUrl: function(doc) {
    var url = doc &&
        // TODO(sjmiles): ShadowDOMPolyfill intrusion
        (doc._URL || (doc.impl && doc.impl._URL)
            || doc.baseURI || doc.URL)
                || '';
    // take only the left side if there is a #
    return url.split('#')[0];
  },
  resolveUrl: function(baseUrl, url) {
    if (this.isAbsUrl(url)) {
      return url;
    }
    return this.compressUrl(this.urlToPath(baseUrl) + url);
  },
  resolveRelativeUrl: function(baseUrl, url) {
    if (this.isAbsUrl(url)) {
      return url;
    }
    return this.makeDocumentRelPath(this.resolveUrl(baseUrl, url));
  },
  isAbsUrl: function(url) {
    return /(^data:)|(^http[s]?:)|(^\/)/.test(url);
  },
  urlToPath: function(baseUrl) {
    var parts = baseUrl.split("/");
    parts.pop();
    parts.push('');
    return parts.join("/");
  },
  compressUrl: function(url) {
    var search = '';
    var searchPos = url.indexOf('?');
    // query string is not part of the path
    if (searchPos > -1) {
      search = url.substring(searchPos);
      url = url.substring(searchPos, 0);
    }
    var parts = url.split('/');
    for (var i=0, p; i<parts.length; i++) {
      p = parts[i];
      if (p === '..') {
        parts.splice(i-1, 2);
        i -= 2;
      }
    }
    return parts.join('/') + search;
  },
  makeDocumentRelPath: function(url) {
    // test url against document to see if we can construct a relative path
    path.urlElt.href = url;
    // IE does not set host if same as document
    if (!path.urlElt.host ||
        (!window.location.port && path.urlElt.port === '80') || 
        (path.urlElt.hostname === window.location.hostname &&
        path.urlElt.port === window.location.port &&
        path.urlElt.protocol === window.location.protocol)) {
      return this.makeRelPath(path.documentURL, path.urlElt.href);
    } else {
      return url;
    }
  },
  // make a relative path from source to target
  makeRelPath: function(source, target) {
    var s = source.split('/');
    var t = target.split('/');
    while (s.length && s[0] === t[0]){
      s.shift();
      t.shift();
    }
    for(var i = 0, l = s.length-1; i < l; i++) {
      t.unshift('..');
    }
    var r = t.join('/');
    return r;
  },
  makeAbsUrl: function(url) {
    path.urlElt.href = url;
    return path.urlElt.href;
  },
  resolvePathsInHTML: function(root, url) {
    url = url || path.documentUrlFromNode(root);
    if (root.hasAttributes && root.hasAttributes()) {
      path.resolveNodeAttributes(root, url);
    }
    path.resolveAttributes(root, url);
    path.resolveStyleElts(root, url);
    // handle template.content
    var templates = root.querySelectorAll('template');
    if (templates) {
      for (var i=0, l=templates.length, t; (i<l) && (t=templates[i]); i++) {
        if (t.content) {
          path.resolvePathsInHTML(t.content, url);
        }
      }
    }
  },
  resolvePathsInStylesheet: function(sheet) {
    var docUrl = path.nodeUrl(sheet);
    sheet.__resource = path.resolveCssText(sheet.__resource, docUrl);
  },
  resolveStyleElts: function(root, url) {
    var styles = root.querySelectorAll('style');
    if (styles) {
      for (var i=0, l=styles.length, s; (i<l) && (s=styles[i]); i++) {  
        path.resolveStyleElt(s, url);
      }
    }
  },
  resolveStyleElt: function(style, url) {
    url = url || path.documentUrlFromNode(style);
    style.textContent = path.resolveCssText(style.textContent, url);
  },
  resolveCssText: function(cssText, baseUrl) {
    var cssText = path.replaceUrlsInCssText(cssText, baseUrl, CSS_URL_REGEXP);
    return path.replaceUrlsInCssText(cssText, baseUrl, CSS_IMPORT_REGEXP);
  },
  replaceUrlsInCssText: function(cssText, baseUrl, regexp) {
    return cssText.replace(regexp, function(m, pre, url, post) {
      var urlPath = url.replace(/["']/g, '');
      urlPath = path.resolveRelativeUrl(baseUrl, urlPath);
      return pre + '\'' + urlPath + '\'' + post;
    });
  },
  resolveAttributes: function(root, url) {
    // search for attributes that host urls
    var nodes = root && root.querySelectorAll(URL_ATTRS_SELECTOR);
    if (nodes) {
      for (var i=0, l=nodes.length, n; (i<l) && (n=nodes[i]); i++) {  
        this.resolveNodeAttributes(n, url);
      }
    }
  },
  resolveNodeAttributes: function(node, url) {
    url = url || path.documentUrlFromNode(node);
    URL_ATTRS.forEach(function(v) {
      var attr = node.attributes[v];
      if (attr && attr.value &&
         (attr.value.search(URL_TEMPLATE_SEARCH) < 0)) {
        var urlPath = path.resolveRelativeUrl(url, attr.value);
        attr.value = urlPath;
      }
    });
  }
};

path.documentURL = path.getDocumentUrl(document);
path.urlElt = document.createElement('a');

// exports

scope.path = path;
scope.getDocumentUrl = path.getDocumentUrl;

})(window.HTMLImports);
