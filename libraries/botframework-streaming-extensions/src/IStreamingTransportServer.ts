/**
 * @module botframework-streaming-extensions
 */
/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import { ReceiveResponse } from './ReceiveResponse';
import { StreamingRequest } from './StreamingRequest';

/// <summary>
/// Interface implemented by StreamingTransportServer classes for each transport type.
/// </summary>
export interface IStreamingTransportServer {
    start(): Promise<string>;
    disconnect(): void;
    send(request: StreamingRequest): Promise<ReceiveResponse>;
}
