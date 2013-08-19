/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

htmlSuite('HTMLImports', function() {
  htmlTest('html/HTMLImports.html');
  htmlTest('html/parser.html');
  htmlTest('html/style-links.html');
});

suite('Path', function() {
  var path = window.HTMLImports.path;
  suite('compressUrl', function() {
    test('compress ".."', function() {
      var url = 'http://foo/../bar/';
      chai.assert.equal(path.compressUrl(url), 'http://bar/');
    });

    test('queryString with "/"', function() {
      var url = 'http://foo/bar?baz="foo/../bar"';
      chai.assert.equal(path.compressUrl(url), url);
    });
  });
});
