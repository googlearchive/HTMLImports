/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

(function(scope) {

  // imports
  var path = scope.path;
  var xhr = scope.xhr;

  var cache = {};

  var Loader = function(onLoad, onComplete) {
    this.onload = onLoad;
    this.oncomplete = onComplete;
    this.inflight = 0;
    this.pending = {};
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
      var url = elt.src || elt.href;
      // ensure we have a standard url that can be used
      // reliably for deduping.
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
        this.onload(url, elt, cache[url]);
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
        cache[url] = resource;
      }
      this.pending[url].forEach(function(e) {
        if (!err) {
          this.onload(url, e, resource);
        }
        this.tail();
      }, this);
      this.pending[url] = null;
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
  scope.Loader = Loader;

})(window.HTMLImports);
