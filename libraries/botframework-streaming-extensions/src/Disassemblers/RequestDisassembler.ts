/**
 * @module botframework-streaming-extensions
 */
/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import { PayloadTypes } from '../Models/PayloadTypes';
import { RequestPayload } from '../Models/RequestPayload';
import { StreamDescription } from '../Models/StreamDescription';
import { PayloadSender } from '../PayloadTransport/PayloadSender';
import { StreamingRequest } from '../StreamingRequest';
import { PayloadDisassembler } from './PayloadDisassembler';
import { StreamWrapper } from './StreamWrapper';

export class RequestDisassembler extends PayloadDisassembler {
    public request: StreamingRequest;
    public payloadType: PayloadTypes = PayloadTypes.request;

    public constructor(sender: PayloadSender, id: string, request: StreamingRequest) {
        super(sender, id);
        this.request = request;
    }

    public async getStream(): Promise<StreamWrapper> {
        let payload: RequestPayload = new RequestPayload(this.request.Verb, this.request.Path);

        if (this.request.Streams) {
            payload.streams = [];

            // tslint:disable-next-line: prefer-for-of
            for (let i = 0; i < this.request.Streams.length; i++) {
                let contentStream = this.request.Streams[i];
                let description: StreamDescription = await PayloadDisassembler.getStreamDescription(contentStream);
                payload.streams.push(description);
            }
        }

        return PayloadDisassembler.serialize(payload);
    }
}
