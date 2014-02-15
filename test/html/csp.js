addEventListener('HTMLImportsLoaded', function() {
  chai.assert.ok(window.externalScriptParsed1, 'externalScriptParsed1');
  chai.assert.ok(window.externalScriptParsed2, 'externalScriptParsed2');
  done();
});