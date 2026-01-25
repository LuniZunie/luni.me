import { ChunkedArray } from "./array.js";
import { FileStorage, fileStorage } from "./storage.js";

export class ChunkedProxy {
    static Type = Object.freeze({
        Chunk: Symbol("type:chunk"),
        Metadata: Symbol("type:metadata")
    });
    static #proxies = [ "types", "directives", "minmax", "colors" ];

    #fileId;
    #cache = {
        metadata: null,
        chunk: new Map()
    };
    #promises = new Map();
    #data = { }

    constructor(fileId, data) {
        this.#fileId = fileId;

        Object.assign(this.#data, data);
        this.#setupProxies();
    }

    get data() {
        return this.#data;
    }
    setMetadataCache(v) {
        this.#cache.metadata = v;
    }

    #setupProxies() {
        Object.defineProperty(this, "features", {
            get() {
                return new ChunkedArray(this.#fileId, this);
            },
            enumerable: true,
            configurable: true
        });

        for (const proxy of ChunkedProxy.#proxies) {
            Object.defineProperty(this, proxy, {
                get() {
                    if (this.#cache.metadata?.[proxy]) {
                        return this.#cache.metadata[proxy];
                    }
                    throw new Error(`File metadata not loaded for ${this.#fileId}. Use await loadMetadata() first.`);
                },
                set(v) {
                    this.#cache.metadata ||= {};
                    this.#cache.metadata[proxy] = v;
                },
                enumerable: true,
                configurable: true
            })
        }
    }

    async load(type, data) {
        switch (type) {
            case ChunkedProxy.Type.Metadata: {
                if (this.#promises.has("metadata")) {
                    return this.#promises.get("metadata");
                } else if (this.#cache.metadata) {
                    return this.#cache.metadata;
                }

                const promise = fileStorage.read(FileStorage.Type.Metadata, { fileId: this.#fileId });
                this.#promises.set("metadata", promise);

                try {
                    this.#cache.metadata = await promise;
                    this.#promises.delete("metadata");
                    return this.#cache.metadata;
                } catch (error) {
                    this.#promises.delete("metadata");
                    throw error;
                }
            } break;
            case ChunkedProxy.Type.Chunk: {
                const chunkIndex = data.chunkIndex,
                      key = `chunk-${data.chunkIndex}`;

                if (this.#promises.has(key)) {
                    return this.#promises.get(key);
                } else if (this.#cache.chunk.has(chunkIndex)) {
                    return this.#cache.chunk.get(chunkIndex);
                }

                const promise = fileStorage.read(FileStorage.Type.Chunk, { fileId: this.#fileId, chunkIndex });
                this.#promises.set(key, promise);

                try {
                    this.#cache.chunk.set(chunkIndex, await promise || [ ]);
                    this.#promises.delete(key);
                    return this.#cache.chunk.get(chunkIndex);
                } catch (error) {
                    this.#promises.delete(key);
                    throw error;
                }
            } break;
        }
    }

    async delete() {
        await fileStorage.delete(this.#fileId);

        this.#cache.metadata = null;
        this.#cache.chunk.clear();

        this.#promises.clear();
    }

    isMetadataLoaded() {
        return this.#cache.metadata !== null;
    }
    isCacheLoaded(chunkIndex) {
        return this.#cache.chunk.has(chunkIndex);
    }
    getLoadedMetadata() {
        return this.#cache.metadata;
    }
};