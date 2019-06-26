import { PromptValidator, PromptOptions,  PromptRecognizerResult } from './prompt';
import { DialogTurnResult, Dialog } from '../dialog';
import { DialogContext } from '../dialogContext';
import { InputHints, TurnContext, Activity, ActionTypes, Attachment } from '../../../botbuilder';

/**
 * Options to control the behavior of AdaptiveCardPrompt
 */
export interface AdaptiveCardPromptOptions {
    /**
     * An Adaptive Card. Can be input here or in constructor
     */
    card?: Attachment;

    /**
     * Message sent (if not null) when user uses text input instead of Adaptive Card Input
     * 
     * @remarks
     * Defaults to: 'Please fill out the Adaptive Card'
     */
    inputFailMessage?: string|null|undefined;

    /**
     * Array of strings matching IDs of required input fields
     * 
     * @remarks
     * The ID strings must exactly match those used in the Adaptive Card JSON Input IDs
     * For JSON:
     * ```json
     * {
        *   "type": "Input.Text",
        *   "id": "myCustomId",
        * },
        *```
        * You would use `"myCustomId"` if you want that to be a required input.
        */
    requiredInputIds?: string[];

    /**
     * Message sent (if not null) when user doesn't submit a required input
     * <Each, Missing, Input> gets appended to the end of the string
     * 
     * @remarks
     * Defaults to: The following inputs are required'
     */
    missingRequiredInputsMessage?: string|null|undefined;

    /**
     * Card will not be redisplayed/re-prompted unless:
     *   * PromptOptions includes a retryPrompt with a card, or
     *   * Number of attempts per displayed card equals this value
     * 
     * @remarks
     * This is meant to prevent the user from providing input to the original, 
     *   and not the re-prompted card
     * Defaults to 3
     */
    attemptsBeforeCardRedisplayed?: number;
}

/**
 * Waits for Adaptive Card Input to be received.
 * 
 * @remarks
 * This prompt is similar to ActivityPrompt but provides features specific to Adaptive Cards:
 *   * Card can be passed in constructor or as prompt/reprompt activity attachment 
 *   * Includes validation for specified required input fields
 *   * Displays custom message if user replies via text and not card input
 *   * Ensures input is only valid if it comes from the appropriate card (not one shown previous to prompt)
 * DO NOT USE WITH CHANNELS THAT DON'T SUPPORT ADAPTIVE CARDS
 */
export class AdaptiveCardPrompt extends Dialog {
    private validator: PromptValidator<object>;
    private _inputFailMessage: string|null|undefined;
    private _requiredInputIds: string[];
    private _missingRequiredInputsMessage: string|null|undefined;
    private _attemptsBeforeCardRedisplayed: number;
    private _promptId: string;
    private _card: Attachment;

    /**
     * Creates a new AdaptiveCardPrompt instance
     * @param dialogId Unique ID of the dialog within its parent `DialogSet` or `ComponentDialog`.
     * @param validator (optional) Validator that will be called each time a new activity is received.
     * @param options (optional) Additional options for AdaptiveCardPrompt behavior
     */
    public constructor(dialogId: string, validator?: PromptValidator<object>, options?: AdaptiveCardPromptOptions) {
        super(dialogId);

        // Necessary for when this compiles to js since strictPropertyInitialization is false/unset in tsconfig
        options = Object.keys(options).length > 0 ? options : {};
        
        this.validator = validator;
        this._inputFailMessage = options.inputFailMessage || 'Please fill out the Adaptive Card';

        this._requiredInputIds = options.requiredInputIds || [];
        this._missingRequiredInputsMessage = options.missingRequiredInputsMessage || 'The following inputs are required';

        this._attemptsBeforeCardRedisplayed = options.attemptsBeforeCardRedisplayed || 3;

        this._card = options.card;
    }

    public get inputFailMessage(): string|null|undefined {
        return this._inputFailMessage;
    }

    public set inputFailMessage(message: string|null|undefined) {
        this._inputFailMessage = message;
    }

    public get requiredInputIds(): string[] {
        return this._requiredInputIds;
    }

    public set requiredInputIds(ids: string[]) {
        this._requiredInputIds = ids;
    }

    public get missingRequiredInputsMessage(): string|null|undefined {
        return this._missingRequiredInputsMessage;
    }

    public set missingRequiredInputsMessage(message: string|null|undefined) {
        this._missingRequiredInputsMessage = message;
    }

    public get attemptsBeforeCardRedisplayed(): number {
        return this._attemptsBeforeCardRedisplayed;
    }

    public set attemptsBeforeCardRedisplayed(attempts: number) {
        this._attemptsBeforeCardRedisplayed = attempts;
    }

    public get promptId(): string {
        return this._promptId;
    }

    public set promptId(id: string) {
        this._promptId = id;
    }

    public get card(): Attachment {
        return this._card;
    }

    public set card(card: Attachment) {
        this._card = card;
    }

    public async beginDialog(dc: DialogContext, options: PromptOptions): Promise<DialogTurnResult> {
        // Initialize prompt state
        const state: any = dc.activeDialog.state as PromptState;
        state.options = options;
        state.state = {};

        // Send initial prompt
        await this.onPrompt(dc.context, state.state, state.options, false);

        return Dialog.EndOfTurn;
    }

    protected async onPrompt(context: TurnContext, state: object, options: PromptOptions, isRetry: boolean): Promise<void> {
        // Should use GUID for C# -- it isn't native to Node, so this keeps dependencies down
        // Only the most recently-prompted card submission is accepted
        this._promptId = `${ Math.random() }`;

        let prompt = isRetry && options.retryPrompt ? (options.retryPrompt as Partial<Activity>) : (options.prompt as Partial<Activity>);

        // Create a prompt if user didn't pass it in through PromptOptions
        if (Object.keys(prompt).length === 0) {
            prompt = {
                attachments: []
            };
        }

        // Use card passed in PromptOptions or if it doesn't exist, use the one passed in from the constructor
        const card = prompt.attachments && prompt.attachments[0] ? prompt.attachments[0] : this._card;
        
        this.validateIsCard(card, isRetry);

        prompt.attachments = [this.addPromptIdToCard(card)];

        await context.sendActivity(prompt, undefined, InputHints.ExpectingInput);
    }

    // Override continueDialog so that we can catch activity.value (which is ignored, by default)
    public async continueDialog(dc: DialogContext): Promise<DialogTurnResult> {
        // Perform base recognition
        const state: PromptState = dc.activeDialog.state as PromptState;
        const recognized: PromptRecognizerResult<object> = await this.onRecognize(dc.context);

        if (state.state['attemptCount'] === undefined) {
            state.state['attemptCount'] = 1;
        } else {
            state.state['attemptCount']++;
        }

        let isValid = false;
        if (this.validator && recognized.succeeded) {
            isValid = await this.validator({
                context: dc.context,
                recognized: recognized,
                state: state.state,
                options: state.options,
                attemptCount: state.state['attemptCount']
            });
        } else if (recognized.succeeded) {
            isValid = true;
        } else {
            // User used text input instead of card input or is missing required Inputs
            if (this._inputFailMessage) {
                await dc.context.sendActivity(this._inputFailMessage);
            }
        }

        // Return recognized value or re-prompt
        if (isValid) {
            return await dc.endDialog(recognized.value);
        } else {
            // Re-prompt, conditionally display card again
            if (state.options.retryPrompt || state.state['attemptCount'] % this._attemptsBeforeCardRedisplayed === 0 ) {
                await this.onPrompt(dc.context, state.state, state.options, true);
            }
            return await Dialog.EndOfTurn;
        }
    }

    protected async onRecognize(context: TurnContext): Promise<PromptRecognizerResult<object>> {
        // Ignore user input that doesn't come from adaptive card
        if (!context.activity.text && context.activity.value) {
            // Validate it comes from the correct card - This is only a worry while the prompt/dialog has not ended
            if (context.activity.value && context.activity.value['promptId'] != this._promptId) {
                return { succeeded: false };
            }
            // Check for required input data, if specified in AdaptiveCardPromptOptions
            let missingIds = [];
            this._requiredInputIds.forEach((id): void => {
                if (!context.activity.value[id] || !context.activity.value[id].trim()) {
                    missingIds.push(id);
                }
            });
            // Alert user to missing data
            if (missingIds.length > 0) {
                if (this._missingRequiredInputsMessage) {
                    await context.sendActivity(`${ this._missingRequiredInputsMessage }: ${ missingIds.join(', ') }`);
                }
                return { succeeded: false };
            }
            return { succeeded: true, value: context.activity.value };
        } else {
            return { succeeded: false };
        }
    }

    private validateIsCard(card: Attachment, isRetry: boolean): void {
        const adaptiveCardType = 'application/vnd.microsoft.card.adaptive';

        if (!card || !card.contentType || card.contentType !== adaptiveCardType) {
            const cardLocation = isRetry ? 'retryPrompt' : 'prompt';
            throw new Error(`No Adaptive Card provided. Include in the constructor or PromptOptions.${ cardLocation }.attachments[0]`);
        }
    }

    private addPromptIdToCard(card: Attachment): Attachment {
        card.content = this.deepSearchJsonForActionsAndAddPromptId(card.content);
        return card;
    }

    private deepSearchJsonForActionsAndAddPromptId(json: object): object {
        const submitAction = 'Action.Submit';
        const showCardAction = 'Action.ShowCard';
    
        for (const key in json) {
            // Search for all submits in actions
            if (key === 'actions') {
                for (const action in json[key]) {
                    if (json[key][action].type && json[key][action].type === submitAction) {
                        json[key][action].data = { ...json[key][action].data, ...{ promptId: this._promptId }};
    
                    // Recursively search Action.ShowCard for Submits within the nested card
                    } else if (json[key][action].type && json[key][action].type === showCardAction) {
                        json[key][action] = this.deepSearchJsonForActionsAndAddPromptId(json[key][action]);
                    }
                }
                
            // Search for all submits in selectActions
            } else if (key === 'selectAction') {
                if (json[key].type && json[key].type === submitAction) {
                    json[key].data = { ...json[key].data, ...{ promptId: this._promptId }};
    
                // Recursively search Action.ShowCard for Submits within the nested card
                } else if (json[key].type && json[key].type === showCardAction) {
                    json[key] = this.deepSearchJsonForActionsAndAddPromptId(json[key]);
                }
    
            // Recursively search all other objects
            } else if (json[key] && typeof json[key] === 'object') {
                json[key] = this.deepSearchJsonForActionsAndAddPromptId(json[key]);
            }
        }
        return json;
    }
}

/**
 * @private
 */
interface PromptState {
    state: object;
    options: PromptOptions;
}