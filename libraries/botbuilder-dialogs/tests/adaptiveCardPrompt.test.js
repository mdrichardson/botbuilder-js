const { ConversationState, MemoryStorage, TestAdapter } = require('botbuilder-core');
const { AdaptiveCardPrompt, DialogReason, DialogSet, DialogTurnStatus } =  require('../');
const { CardFactory } = require('botbuilder');
const assert = require('assert');
const sinon = require('sinon');

const cardJson = require('./adaptiveCard.json');
const card = CardFactory.adaptiveCard(cardJson);

describe('AdaptiveCardPrompt', function() {
    // TODO: Set back to 5000
    this.timeout(5000 * 999);

    let simulatedInput = {
        type: 'message',
        value: {
            FoodChoice: 'Steak',
            SteakOther: 'some details',
            SteakTemp: 'rare',
            promptId: '123' // Stub this with Math.random()
        }
    };

    this.beforeEach(() => {
        simulatedInput = {
            type: 'message',
            value: {
                FoodChoice: 'Steak',
                SteakOther: 'some details',
                SteakTemp: 'rare',
                promptId: '123' // Stub this with Math.random()
            }
        };
    });

    this.afterEach(() => {
        sinon.restore();
    });

    // TODO: Test other initialization options
    it('should call AdaptiveCardPrompt using dc.prompt().', async function() {
        // Initialize TestAdapter.
        const prompt = new AdaptiveCardPrompt('prompt');

        // Ensure we get the right promptId
        sinon.stub(Math, 'random').returns(123);

        const adapter = new TestAdapter(async turnContext => {
            const dc = await dialogs.createContext(turnContext);

            const results = await dc.continueDialog();
            if (results.status === DialogTurnStatus.empty) {
                await dc.prompt('prompt', { prompt: { attachments: [card] } });
            } else if (results.status === DialogTurnStatus.complete) {
                const reply = results.result;
                await turnContext.sendActivity(`You said ${ JSON.stringify(reply) }`);
            }
            await convoState.saveChanges(turnContext);
        });
        // Create new ConversationState with MemoryStorage and register the state as middleware.
        const convoState = new ConversationState(new MemoryStorage());

        // Create a DialogState property, DialogSet and TextPrompt.
        const dialogState = convoState.createProperty('dialogState');
        const dialogs = new DialogSet(dialogState);
        dialogs.add(prompt);

        await adapter.send('Hello')
            .assertReply((activity) => {
                assert.equal(activity.attachments[0].contentType, 'application/vnd.microsoft.card.adaptive');
            })
            .send(simulatedInput)
            .assertReply(`You said ${ JSON.stringify(simulatedInput.value) }`);
    });

    it('should call AdaptiveCardPrompt using dc.beginDialog().', async function() {
        // Initialize TestAdapter.
        const prompt = new AdaptiveCardPrompt('prompt');

        // Ensure we get the right promptId
        sinon.stub(Math, 'random').returns(123);

        const adapter = new TestAdapter(async turnContext => {
            const dc = await dialogs.createContext(turnContext);

            const results = await dc.continueDialog();
            if (results.status === DialogTurnStatus.empty) {
                await dc.beginDialog('prompt', { prompt: { attachments: [card] } });
            } else if (results.status === DialogTurnStatus.complete) {
                const reply = results.result;
                await turnContext.sendActivity(`You said ${ JSON.stringify(reply) }`);
            }
            await convoState.saveChanges(turnContext);
        });
        // Create new ConversationState with MemoryStorage and register the state as middleware.
        const convoState = new ConversationState(new MemoryStorage());

        // Create a DialogState property, DialogSet and TextPrompt.
        const dialogState = convoState.createProperty('dialogState');
        const dialogs = new DialogSet(dialogState);
        dialogs.add(prompt);

        await adapter.send('Hello')
            .assertReply((activity) => {
                assert.equal(activity.attachments[0].contentType, 'application/vnd.microsoft.card.adaptive');
            })
            .send(simulatedInput)
            .assertReply(`You said ${ JSON.stringify(simulatedInput.value) }`);
    });

    it('should create a new promptId for each onPrompt() call.', async function() {
        // Initialize TestAdapter.
        const prompt = new AdaptiveCardPrompt('prompt');

        // Ensure we get the right promptId
        sinon.stub(Math, 'random')
            .onFirstCall().returns(123)
            .onSecondCall().returns(456);

        const adapter = new TestAdapter(async turnContext => {
            const dc = await dialogs.createContext(turnContext);

            const results = await dc.continueDialog();
            if (results.status === DialogTurnStatus.empty) {
                await dc.prompt('prompt', { prompt: { attachments: [card] } });
            } else if (results.status === DialogTurnStatus.complete) {
                const reply = results.result;
                await turnContext.sendActivity(reply['promptId']);
            }
            await convoState.saveChanges(turnContext);
        });
        // Create new ConversationState with MemoryStorage and register the state as middleware.
        const convoState = new ConversationState(new MemoryStorage());

        // Create a DialogState property, DialogSet and TextPrompt.
        const dialogState = convoState.createProperty('dialogState');
        const dialogs = new DialogSet(dialogState);
        dialogs.add(prompt);

        await adapter.send('Hello')
            .assertReply((activity) => {
                assert.equal(activity.attachments[0].contentType, 'application/vnd.microsoft.card.adaptive');
            })
            .send(simulatedInput)
            .assertReply('123');
        simulatedInput.value.promptId = '456';
        await adapter.send('Hello')
            .assertReply((activity) => {
                assert.equal(activity.attachments[0].contentType, 'application/vnd.microsoft.card.adaptive');
            })
            .send(simulatedInput)
            .assertReply('456');
    });

    it('should use retryPrompt on retries, if given', async function() {
        // Initialize TestAdapter.
        const prompt = new AdaptiveCardPrompt('prompt');

        // Ensure we get the right promptId
        sinon.stub(Math, 'random')
            .onFirstCall().returns(123)
            .onSecondCall().returns(456);

        const adapter = new TestAdapter(async turnContext => {
            const dc = await dialogs.createContext(turnContext);

            const results = await dc.continueDialog();
            if (results.status === DialogTurnStatus.empty) {
                await dc.prompt('prompt', { prompt: { attachments: [card] }, retryPrompt: { text: 'RETRY', attachments: [card] } });
            }
            await convoState.saveChanges(turnContext);
        });
        // Create new ConversationState with MemoryStorage and register the state as middleware.
        const convoState = new ConversationState(new MemoryStorage());

        // Create a DialogState property, DialogSet and TextPrompt.
        const dialogState = convoState.createProperty('dialogState');
        const dialogs = new DialogSet(dialogState);
        dialogs.add(prompt);

        await adapter.send('Hello')
            .assertReply((activity) => {
                assert.equal(activity.attachments[0].contentType, 'application/vnd.microsoft.card.adaptive');
            })
            .send('abc')
            .assertReply('Please fill out the Adaptive Card')
            .assertReply('RETRY');
    });

    it('prompt can be string if card passed in constructor', async function() {
        // Initialize TestAdapter.
        const prompt = new AdaptiveCardPrompt('prompt', null, { card: card });

        // Ensure we get the right promptId
        sinon.stub(Math, 'random')
            .onFirstCall().returns(123);

        const adapter = new TestAdapter(async turnContext => {
            const dc = await dialogs.createContext(turnContext);

            const results = await dc.continueDialog();
            if (results.status === DialogTurnStatus.empty) {
                await dc.prompt('prompt', { prompt: 'STRING' });
            }
            await convoState.saveChanges(turnContext);
        });
        // Create new ConversationState with MemoryStorage and register the state as middleware.
        const convoState = new ConversationState(new MemoryStorage());

        // Create a DialogState property, DialogSet and TextPrompt.
        const dialogState = convoState.createProperty('dialogState');
        const dialogs = new DialogSet(dialogState);
        dialogs.add(prompt);

        await adapter.send('Hello')
            .assertReply('STRING');
    });

    it('should throw if no attachment passed in constructor or set', async function() {
        // Initialize TestAdapter.
        const prompt = new AdaptiveCardPrompt('prompt', null, { });

        // Ensure we get the right promptId
        sinon.stub(Math, 'random')
            .onFirstCall().returns(123);

        const adapter = new TestAdapter(async turnContext => {
            const dc = await dialogs.createContext(turnContext);

            const results = await dc.continueDialog();
            if (results.status === DialogTurnStatus.empty) {
                try {
                    await dc.prompt('prompt', {});
                } catch (err) {
                    await dc.context.sendActivity(err.message);
                }
            }
            await convoState.saveChanges(turnContext);
        });
        // Create new ConversationState with MemoryStorage and register the state as middleware.
        const convoState = new ConversationState(new MemoryStorage());

        // Create a DialogState property, DialogSet and TextPrompt.
        const dialogState = convoState.createProperty('dialogState');
        const dialogs = new DialogSet(dialogState);
        dialogs.add(prompt);

        await adapter.send('Hello')
            .assertReply('No Adaptive Card provided. Include in the constructor or PromptOptions.prompt.attachments[0]');
    });

    it('should throw if card is not a valid adaptive card', async function() {
        // Initialize TestAdapter.
        const prompt = new AdaptiveCardPrompt('prompt', null, { card: { content: cardJson, contentType: 'invalidCard' } });

        // Ensure we get the right promptId
        sinon.stub(Math, 'random')
            .onFirstCall().returns(123);

        const adapter = new TestAdapter(async turnContext => {
            const dc = await dialogs.createContext(turnContext);

            const results = await dc.continueDialog();
            if (results.status === DialogTurnStatus.empty) {
                try {
                    await dc.prompt('prompt', {});
                } catch (err) {
                    await dc.context.sendActivity(err.message);
                }
            }
            await convoState.saveChanges(turnContext);
        });
        // Create new ConversationState with MemoryStorage and register the state as middleware.
        const convoState = new ConversationState(new MemoryStorage());

        // Create a DialogState property, DialogSet and TextPrompt.
        const dialogState = convoState.createProperty('dialogState');
        const dialogs = new DialogSet(dialogState);
        dialogs.add(prompt);

        await adapter.send('Hello')
            .assertReply(`Attachment is not a valid Adaptive Card.\n`+
            `Ensure card.contentType is 'application/vnd.microsoft.card.adaptive'\n`+
            `and card.content contains the card json`);
    });

    it('should accept a custom validator that handles valid context', async function() {
        // Initialize TestAdapter.
        let usedValidator = false;
        const prompt = new AdaptiveCardPrompt('prompt', async () => {
            usedValidator = true;
            return true;
        });

        // Ensure we get the right promptId
        sinon.stub(Math, 'random').returns(123);

        const adapter = new TestAdapter(async turnContext => {
            const dc = await dialogs.createContext(turnContext);

            const results = await dc.continueDialog();
            if (results.status === DialogTurnStatus.empty) {
                await dc.prompt('prompt', { prompt: { attachments: [card] } });
            } else if (results.status === DialogTurnStatus.complete) {
                const reply = results.result;
                await turnContext.sendActivity(`You said ${ JSON.stringify(reply) }`);
            }
            await convoState.saveChanges(turnContext);
        });
        // Create new ConversationState with MemoryStorage and register the state as middleware.
        const convoState = new ConversationState(new MemoryStorage());

        // Create a DialogState property, DialogSet and TextPrompt.
        const dialogState = convoState.createProperty('dialogState');
        const dialogs = new DialogSet(dialogState);
        dialogs.add(prompt);

        await adapter.send('Hello')
            .assertReply((activity) => {
                assert.equal(activity.attachments[0].contentType, 'application/vnd.microsoft.card.adaptive');
            })
            .send(simulatedInput)
            .assertReply(`You said ${ JSON.stringify(simulatedInput.value) }`);
        assert.equal(usedValidator, true);
    });

    it('should track the number of attempts', async function() {
        // Initialize TestAdapter.
        let usedValidator = true;
        let attempts = 0;
        const prompt = new AdaptiveCardPrompt('prompt', async (context) => {
            attempts = context.state['attemptCount'];
            return false;
        }, { attemptsBeforeCardRedisplayed: 99 });

        // Ensure we get the right promptId
        sinon.stub(Math, 'random').returns(123);

        const adapter = new TestAdapter(async turnContext => {
            const dc = await dialogs.createContext(turnContext);

            const results = await dc.continueDialog();
            if (results.status === DialogTurnStatus.empty) {
                await dc.prompt('prompt', { prompt: { attachments: [card] } });
            } else if (results.status === DialogTurnStatus.waiting) {
                await turnContext.sendActivity(`Invalid Response`);
            }
            await convoState.saveChanges(turnContext);
        });
        // Create new ConversationState with MemoryStorage and register the state as middleware.
        const convoState = new ConversationState(new MemoryStorage());

        // Create a DialogState property, DialogSet and TextPrompt.
        const dialogState = convoState.createProperty('dialogState');
        const dialogs = new DialogSet(dialogState);
        dialogs.add(prompt);

        await adapter.send('Hello')
            .assertReply((activity) => {
                assert.equal(activity.attachments[0].contentType, 'application/vnd.microsoft.card.adaptive');
            })
            .send(simulatedInput)
            .assertReply('Invalid Response')
            .send(simulatedInput)
            .assertReply('Invalid Response')
            .send(simulatedInput)
            .assertReply('Invalid Response');
        assert.equal(usedValidator, true);
        assert.equal(attempts, 3);
    });

    it('should recognize card input', async function() {
        // Initialize TestAdapter.
        let usedValidator = false;
        const prompt = new AdaptiveCardPrompt('prompt', async (context) => {
            assert.equal(context.recognized.succeeded, true);
            usedValidator = true;
            return true;
        });

        // Ensure we get the right promptId
        sinon.stub(Math, 'random').returns(123);

        const adapter = new TestAdapter(async turnContext => {
            const dc = await dialogs.createContext(turnContext);

            const results = await dc.continueDialog();
            if (results.status === DialogTurnStatus.empty) {
                await dc.prompt('prompt', { prompt: { attachments: [card] } });
            } else if (results.status === DialogTurnStatus.complete) {
                const reply = results.result;
                await turnContext.sendActivity(`You said ${ JSON.stringify(reply) }`);
            }
            await convoState.saveChanges(turnContext);
        });
        // Create new ConversationState with MemoryStorage and register the state as middleware.
        const convoState = new ConversationState(new MemoryStorage());

        // Create a DialogState property, DialogSet and TextPrompt.
        const dialogState = convoState.createProperty('dialogState');
        const dialogs = new DialogSet(dialogState);
        dialogs.add(prompt);

        assert(simulatedInput.value && !simulatedInput.text);

        await adapter.send('Hello')
            .assertReply((activity) => {
                assert.equal(activity.attachments[0].contentType, 'application/vnd.microsoft.card.adaptive');
            })
            .send(simulatedInput)
            .assertReply(`You said ${ JSON.stringify(simulatedInput.value) }`);
        assert.equal(usedValidator, true);
    });

    it('should not recognize text input and should display custom input fail message', async function() {
        // Note: Validator isn't if !recognized.succeeded
        // Initialize TestAdapter.
        simulatedInput.value = undefined;
        simulatedInput.text = 'Should fail';
        const failMessage = 'Test input fail message';
        const prompt = new AdaptiveCardPrompt('prompt', null, {
            inputFailMessage: failMessage
        });

        // Ensure we get the right promptId
        sinon.stub(Math, 'random').returns(123);

        const adapter = new TestAdapter(async turnContext => {
            const dc = await dialogs.createContext(turnContext);

            const results = await dc.continueDialog();
            if (results.status === DialogTurnStatus.empty) {
                await dc.prompt('prompt', { prompt: { attachments: [card] } });
            }
            await convoState.saveChanges(turnContext);
        });
        // Create new ConversationState with MemoryStorage and register the state as middleware.
        const convoState = new ConversationState(new MemoryStorage());

        // Create a DialogState property, DialogSet and TextPrompt.
        const dialogState = convoState.createProperty('dialogState');
        const dialogs = new DialogSet(dialogState);
        dialogs.add(prompt);

        await adapter.send('Hello')
            .assertReply((activity) => {
                assert.equal(activity.attachments[0].contentType, 'application/vnd.microsoft.card.adaptive');
            })
            .send(simulatedInput)
            .assertReply(failMessage);
    });

    it('should not successfully recognize if input comes from card with wrong id', async function() {
        // Note: Validator isn't if !recognized.succeeded
        // Initialize TestAdapter.
        simulatedInput.value.promptId = 'wrongId';
        const prompt = new AdaptiveCardPrompt('prompt');

        // Ensure we get the right promptId
        sinon.stub(Math, 'random').returns(123);

        const adapter = new TestAdapter(async turnContext => {
            const dc = await dialogs.createContext(turnContext);

            const results = await dc.continueDialog();
            if (results.status === DialogTurnStatus.empty) {
                await dc.prompt('prompt', { prompt: { attachments: [card] } });
            } else if (results.status === DialogTurnStatus.waiting) {
                await turnContext.sendActivity(`Invalid Response`);
            }
            await convoState.saveChanges(turnContext);
        });
        // Create new ConversationState with MemoryStorage and register the state as middleware.
        const convoState = new ConversationState(new MemoryStorage());

        // Create a DialogState property, DialogSet and TextPrompt.
        const dialogState = convoState.createProperty('dialogState');
        const dialogs = new DialogSet(dialogState);
        dialogs.add(prompt);

        await adapter.send('Hello')
            .assertReply((activity) => {
                assert.equal(activity.attachments[0].contentType, 'application/vnd.microsoft.card.adaptive');
            })
            .send(simulatedInput)
            .assertReply(`Invalid Response`);
    });

    it('should not successfully recognize with missing required ids and should use custom missing ids message', async function() {
        // Note: Validator isn't if !recognized.succeeded
        // Initialize TestAdapter.
        const prompt = new AdaptiveCardPrompt('prompt', null, {
            requiredInputIds: ['test1', 'test2', 'test3'],
            missingRequiredInputsMessage: 'test inputs missing'
        });

        // Ensure we get the right promptId
        sinon.stub(Math, 'random').returns(123);

        const adapter = new TestAdapter(async turnContext => {
            const dc = await dialogs.createContext(turnContext);

            const results = await dc.continueDialog();
            if (results.status === DialogTurnStatus.empty) {
                await dc.prompt('prompt', { prompt: { attachments: [card] } });
            }
            await convoState.saveChanges(turnContext);
        });
        // Create new ConversationState with MemoryStorage and register the state as middleware.
        const convoState = new ConversationState(new MemoryStorage());

        // Create a DialogState property, DialogSet and TextPrompt.
        const dialogState = convoState.createProperty('dialogState');
        const dialogs = new DialogSet(dialogState);
        dialogs.add(prompt);

        await adapter.send('Hello')
            .assertReply((activity) => {
                assert.equal(activity.attachments[0].contentType, 'application/vnd.microsoft.card.adaptive');
            })
            .send(simulatedInput)
            .assertReply('test inputs missing: test1, test2, test3');
    });

    it('should successfully recognize if all required ids supplied', async function() {
        // Note: Validator isn't if !recognized.succeeded
        // Initialize TestAdapter.
        const prompt = new AdaptiveCardPrompt('prompt', null, {
            requiredInputIds: Object.keys(simulatedInput.value),
            missingRequiredInputsMessage: 'test inputs missing'
        });

        // Ensure we get the right promptId
        sinon.stub(Math, 'random').returns(123);

        const adapter = new TestAdapter(async turnContext => {
            const dc = await dialogs.createContext(turnContext);

            const results = await dc.continueDialog();
            if (results.status === DialogTurnStatus.empty) {
                await dc.prompt('prompt', { prompt: { attachments: [card] } });
            } else if (results.status === DialogTurnStatus.complete) {
                const reply = results.result;
                await turnContext.sendActivity(`You said ${ JSON.stringify(reply) }`);
            }
            await convoState.saveChanges(turnContext);
        });
        // Create new ConversationState with MemoryStorage and register the state as middleware.
        const convoState = new ConversationState(new MemoryStorage());

        // Create a DialogState property, DialogSet and TextPrompt.
        const dialogState = convoState.createProperty('dialogState');
        const dialogs = new DialogSet(dialogState);
        dialogs.add(prompt);

        await adapter.send('Hello')
            .assertReply((activity) => {
                assert.equal(activity.attachments[0].contentType, 'application/vnd.microsoft.card.adaptive');
            })
            .send(simulatedInput)
            .assertReply(`You said ${ JSON.stringify(simulatedInput.value) }`);
    });
});
