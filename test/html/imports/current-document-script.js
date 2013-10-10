chai.assert.ok(currentDocument, 'import is set');
var node = currentDocument.querySelector('#node-from-import');
chai.assert.ok(node, 'node found in import');
document.body.appendChild(node);
