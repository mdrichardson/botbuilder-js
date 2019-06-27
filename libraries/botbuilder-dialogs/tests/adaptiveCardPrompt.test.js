const { ConversationState, MemoryStorage, TestAdapter } = require('botbuilder-core');
const { AdaptiveCardPrompt, DialogReason, DialogSet, DialogTurnStatus } =  require('../');
const { CardFactory } = require('botbuilder');
const assert = require('assert');
const sinon = require('sinon');

const cardJson = require('./adaptiveCard.json');
const card = CardFactory.adaptiveCard(cardJson);

describe('AdaptiveCardPrompt', function() {
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

    // TODO: FIgure out why taking card out of PromptOptions breaks things
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
});
