/*
 * Copyright 2013 The Toolkitchen Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

var assert = chai.assert;
var lastError = {
  stack: "(no stack)"
};

(function() {
  chai.Assertion.includeStack = true;

  // catches exceptions only, not other asserts
  var originalAssert = chai.Assertion.prototype.assert;
  chai.Assertion.prototype.assert = function() {
    try {
      originalAssert.apply(this, arguments);
    } catch(x) {
      lastError = x;
      throw(x);
    }
  };
})();



