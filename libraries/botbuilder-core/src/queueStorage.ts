/**
 * @module botbuilder
 */
/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { Activity } from 'botframework-schema';

/**
 * A base class for enqueueing an Activity for later processing.
 */
export abstract class QueueStorage {
    /**
     * Enqueues an Activity for later processing. The visibility timeout specifies how long the message should be visible
     * to Dequeue and Peek operations. The message content must be a UTF-8 encoded string that is up to 64KB in size.
     *
     * @param {Partial<Activity>} activity The [Activity](xref:botframework-schema.Activity) to be queued for later processing.
     * @param {number} visibilityTimeout Visibility timeout in seconds. Optional with a default value of 0. Cannot be larger than 7 days.
     * @param {number} timeToLive Specifies the time-to-live interval for the message in seconds.
     */
    public abstract queueActivity(
        activity: Partial<Activity>,
        visibilityTimeout?: number,
        timeToLive?: number
    ): Promise<string>;
}
