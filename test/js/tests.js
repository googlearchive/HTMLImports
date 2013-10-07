/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

htmlSuite('HTMLImports', function() {
  if (HTMLImports.useNative) {
    htmlTest('html/parser.html');
    htmlTest('html/style-links.html');
  } else {
    htmlTest('html/HTMLImports.html');
    htmlTest('html/parser.html');
    htmlTest('html/style-links.html');
    htmlTest('html/path.html');  
  }
});
