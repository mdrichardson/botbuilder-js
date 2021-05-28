const { TestUtils } = require('../lib');
const { makeResourceExplorer } = require('./utils');

describe('ActionScopeTests', function () {
    let resourceExplorer;
    before(function () {
        resourceExplorer = makeResourceExplorer('FunctionsTests');
    });

    it('HasPendingActions', async () => {
        await TestUtils.runTestScript(resourceExplorer, 'HasPendingActions');
    });

    it('IsDialogActive', async () => {
        await TestUtils.runTestScript(resourceExplorer, 'IsDialogActive');
    });
});
