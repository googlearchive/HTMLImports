remoteCurrentScriptExecuted = window.remoteCurrentScriptExecuted || 0;
remoteCurrentScriptExecuted++;
chai.assert.ok(document._currentScript);