/**
 * @module botbuilder-azure
 */
/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { Storage, StoreItems } from 'botbuilder';
import { ConnectionPolicy, CosmosClient, Database, Container, RequestOptions,CosmosClientOptions, PartitionKind } from '@azure/cosmos';
import { CosmosDbKeyEscape } from './cosmosDbKeyEscape';

// @types/documentdb does not have DocumentBase definition
const DocumentBase: any = require('documentdb').DocumentBase; // tslint:disable-line no-require-imports no-var-requires

/**
 * Additional settings for configuring an instance of `CosmosDbStorage`.
 */
export interface CosmosDbStorageSettings {
    /**
     * The endpoint Uri for the service endpoint from the Azure Cosmos DB service.
     */
     serviceEndpoint: string;
    /**
     * The AuthKey used by the client from the Azure Cosmos DB service.
     */
    authKey: string;
    /**
     * The Database ID.
     */
    databaseId: string;
    /**
     * The Collection ID.
     * Note that @azure/cosmos calls collections "containers".
     *  "Collection" will still be used for backwards-compatibility where appropriate
     */
    collectionId: string;
    /**
     * The Partition Key. If specified, allows you to use CosmosDB partitioning.
     */
    partitionKey?: string;
    /**
     * The Partition Value. If specified, you can have different bots use different partition values.
     * partitionValue is still optional if partitionKey is specified; it will have an undefined value, but still work.
     * Note that @azure/cosmos uses { [partitionKey]: partitionValue } for querySpec and body Objects 
     *  and uses { partitionKey: partitionValue } for FeedOptions and RequestOptions Objects.
     */
    partitionValue?: string;
    /**
     * (Optional) Cosmos DB RequestOptions that are passed when the database is created.
     */
    databaseCreationRequestOptions?: RequestOptions;
    /**
     * (Optional) Cosmos DB RequestOptiones that are passed when the document collection is created.
     */
    documentCollectionRequestOptions?: RequestOptions;
}

/**
 * @private
 * Internal data structure for storing items in DocumentDB
 */
interface DocumentStoreItem {
    /**
     * Represents the Sanitized Key and used as PartitionKey on DocumentDB
     */
    id: string;
    /**
     * Represents the original Id/Key
     */
    realId: string;
    /**
     * The item itself + eTag information
     */
    document: any;
    /**
     * The partitionKey (optional)
     */
    paritionKey?: any;
}

/**
 * Middleware that implements a CosmosDB based storage provider for a bot.
 *
 * @remarks
 * The `connectionPolicyConfigurator` handler can be used to further customize the connection to
 * CosmosDB (Connection mode, retry options, timeouts). More information at
 * http://azure.github.io/azure-documentdb-node/global.html#ConnectionPolicy
 */
export class CosmosDbStorage implements Storage {

    private settings: CosmosDbStorageSettings;
    private client: CosmosClient;
    private container: Container;
    private database: Database;
    private documentCollectionCreationRequestOption: RequestOptions;
    private databaseCreationRequestOption: RequestOptions;

    /**
     * Creates a new ConsmosDbStorage instance.
     *
     * @param settings Setting to configure the provider.
     * @param connectionPolicyConfigurator (Optional) An optional delegate that accepts a ConnectionPolicy for customizing policies. More information at http://azure.github.io/azure-documentdb-node/global.html#ConnectionPolicy
     */
    public constructor(
        settings: CosmosDbStorageSettings,
        connectionPolicyConfigurator: (policy: ConnectionPolicy) => void = null
    ) {
        if (!settings) {
            throw new Error('The settings parameter is required.');
        }

        if (!settings.serviceEndpoint || settings.serviceEndpoint.trim() === '') {
            throw new Error('The settings service Endpoint is required.');
        }

        if (!settings.authKey || settings.authKey.trim() === '') {
            throw new Error('The settings authKey is required.');
        }

        if (!settings.databaseId || settings.databaseId.trim() === '') {
            throw new Error('The settings dataBase ID is required.');
        }

        if (!settings.collectionId || settings.collectionId.trim() === '') {
            throw new Error('The settings collection ID is required.');
        }

        this.settings = {...settings};

        // Invoke collectionPolicy delegate to further customize settings
        const policy: ConnectionPolicy = new DocumentBase.ConnectionPolicy();
        if (connectionPolicyConfigurator && typeof connectionPolicyConfigurator === 'function') {
            connectionPolicyConfigurator(policy);
        }

        const cosmosClientOptions: CosmosClientOptions = {
            auth: { masterKey: settings.authKey },
            endpoint: settings.serviceEndpoint,
            connectionPolicy: policy,
        }

        // this.database and this.container get defined after the first run of ensureContainerExists()
        this.client = new CosmosClient(cosmosClientOptions);
        this.database = null;
        this.container = null;

        this.databaseCreationRequestOption = settings.databaseCreationRequestOptions;
        this.documentCollectionCreationRequestOption = settings.documentCollectionRequestOptions;

        // Add a "/" to the beginning of partitionKey, if necessary
        if (this.settings.partitionKey) {
            this.settings.partitionKey = this.settings.partitionKey.charAt(0) !== '/' ? '/' + this.settings.partitionKey : this.settings.partitionKey;
        }
        // If the partitionKey is the same as a key in the DocumentItem, it will cause an overwrite
        if (['/id', '/realId', '/document'].indexOf(this.settings.partitionKey) !== -1) {
            throw new Error('partitionKey cannot be set to "id", "realId", or "document"');
        }
    }

    public async read (keys: string[]): Promise<StoreItems> {
        if (!keys || keys.length === 0) {
            // No keys passed in, no result to return.
            return {};
        }

        const parameterSequence: string = Array.from(Array(keys.length).keys())
            .map((ix: number) => `@id${ix}`)
            .join(',');
        const parameterValues: {
            name: string;
            value: string;
            partitionKey?: string;
        }[] = keys.map((key: string, ix: number) => ({
            name: `@id${ix}`,
            value: CosmosDbKeyEscape.escapeKey(key),
            ...this.formatPartitionKeyValue(),
        }));

        const querySpec: {
            query: string;
            parameters: {
                name: string;
                value: string;
                partitionKey?: string;
            }[];
        } = {
            query: `SELECT c.id, c.realId, c.document, c._etag FROM c WHERE c.id in (${parameterSequence})`,
            parameters: parameterValues
        };

        await this.ensureContainerExists();
        
        return await (async (): Promise<StoreItems> => {
            const storeItems: StoreItems = {};
            try {
                const reqOptions = { partitionKey: this.settings.partitionValue };
                const query = await this.container.items
                                        .query(querySpec, reqOptions)
                                        .toArray();
                // Push documents to storeItems
                query.result.map(resource => {
                    storeItems[resource.realId] = resource.document;
                    storeItems[resource.realId].eTag = resource._etag;
                });
                return storeItems;
                
            } catch (err) {
                throw new Error(`Error reading from container: ${JSON.stringify(err)}`);
            }
        })();
    }

    public async write(changes: StoreItems): Promise<void> {
        if (!changes || Object.keys(changes).length === 0) {
            return;
        }
        
        await this.ensureContainerExists();
        
        return await (async (): Promise<void> => {
            Object.keys(changes).map(async (k: string) => {
                const changesCopy: any = {...changes[k]};

                // Remove etag from JSON object that was copied from IStoreItem.
                // The ETag information is updated as an _etag attribute in the document metadata.
                delete changesCopy.eTag;
                const documentChange: DocumentStoreItem = {
                    id: CosmosDbKeyEscape.escapeKey(k),
                    realId: k,
                    document: changesCopy,
                    ...this.formatPartitionKeyValue(),
                };

                return await (async () => {
                    const eTag: string = changes[k].eTag;
                    if (!eTag || eTag === '*') {
                        // If new item or *, then insert or replace unconditionally
                        try {
                            await this.container.items
                                    .upsert(documentChange, { disableAutomaticIdGeneration: true });
                        } catch (err) {
                            throw new Error(`Error upserting document: ${JSON.stringify(err)}`);
                        }
                    } else if (eTag.length > 0) {
                        // If we have an etag, do opt. concurrency replace
                        try {
                            const reqOptions = {
                                accessCondition: { type: 'IfMatch', condition: eTag },
                                partitionKey: this.settings.partitionValue,
                            };
                            await this.container
                                    .item(CosmosDbKeyEscape.escapeKey(k), this.settings.partitionKey)
                                    .replace(documentChange, reqOptions);
                        } catch (err) {
                            throw new Error(`Error replacing document: ${JSON.stringify(err)}`)
                        }
                    } else {
                        throw new Error(`etag empty`);
                    }
                })();
            });
        })();
    }

    public async delete(keys: string[]): Promise<void> {
        if (!keys || keys.length === 0) {
            return Promise.resolve();
        }

        await this.ensureContainerExists();

        await keys.map(async (k: string) => {
            try {
                const reqOptions = { partitionKey: this.settings.partitionValue };
                await this.container
                    .item(CosmosDbKeyEscape.escapeKey(k), this.settings.partitionKey)
                    .delete(reqOptions);
            } catch (err) {
                // Don't thow an error if trying to delete something that doesn't exist
                if (err.code !== 404) {
                    throw new Error(`Unable to delete document: ${JSON.stringify(err)}`);
                }
            }
        });
    }

    /**
     * Ensures that database and container have been initialized. Create them if they haven't
     */
    private async ensureContainerExists(): Promise<void> {
        if (!this.database) {
            await this.getOrCreateDatabase();
        }
        if (!this.container) {
            await this.getOrCreateContainer();
        }
    }

    private async getOrCreateDatabase() {
        try {
            const dbResponse = await this.client.databases
                                        .createIfNotExists({ id: this.settings.databaseId }, this.databaseCreationRequestOption);
            this.database = dbResponse.database;
            return this.database;
        } catch (err) {
            // Don't throw an error if the database already exists
            if (err.code !== 409) {
                throw new Error(`Error initializing database: ${JSON.stringify(err)}`);
            }
        }
    }

    private async getOrCreateContainer() {
        try {
            const partitionKeyOption = {
                paths: [this.settings.partitionKey],
                kind: PartitionKind.Hash,
            } 
            const reqOptions = {
                id: this.settings.collectionId,
                partitionKey: this.settings.partitionKey ? partitionKeyOption : undefined,
            }
            const coResponse = await this.database.containers
                                        .createIfNotExists(reqOptions, this.documentCollectionCreationRequestOption);
            this.container = coResponse.container;
            return this.container;
        } catch (err) {
            // Don't throw an error if the container already exists
            if (err.code !== 409) {
                throw new Error(`Error initializing container: ${JSON.stringify(err)}`);
            }
        }
    }

    private formatPartitionKeyValue(): Object {
        return this.settings.partitionKey ?
                    {[this.settings.partitionKey.substr(1)]: this.settings.partitionValue || ''} :
                    {}
    }
}