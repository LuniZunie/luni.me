import { CHUNK_SIZE } from "./storage.js";

export class ChunkedArray {
    #fileId;
    #proxy;
    #length;

    constructor(fileId, proxy) {
        this.#fileId = fileId;
        this.#proxy = proxy;
    }

    async ready() {
        if (!this.#proxy.isMetadataLoaded()) {
            await this.#proxy.loadMetadata();
        }
    }

    get length() {
        if (this.#length === null) {
            if (this.#proxy.isMetadataLoaded())
                return this.#proxy.getLoadedMetadata().features || 0;

            throw new Error(`Cannot get length: metadata not loaded for ${this.#fileId}`);
        } else {
            return this.#length;
        }
    }

    async at(i) {
        await this.ready();

        const chunkIndex = Math.floor(i / CHUNK_SIZE),
              indexInChunk = i % CHUNK_SIZE;

        const chunk = await this.#proxy.loadChunk(chunkIndex);
        return chunk[indexInChunk] || null;
    }

    async *[Symbol.asyncIterator]() {
        await this.ready();

        const metadata = this.#proxy.getLoadedMetadata(),
              chunks = metadata.chunks || 0;

        for (let i = 0; i < chunks; i++) {
            const chunk = await this.#proxy.loadChunk(i);
            for (const feature of chunk) {
                yield feature;
            }
        }
    }

    /* Should only be used if chunks are already loaded — use carefully */
    *[Symbol.iterator]() {
        for (const [ , chunk ] of this.#proxy.chunkCache) {
            for (const feature of chunk ) {
                yield feature;
            }
        }
    }

    async forEach(callback) {
        let i = 0;
        for await (const feature of this) {
            callback(feature, i++, this);
        }
    }

    async map(callback) {
        let i = 0;
        const result = [];
        for await (const feature of this) {
            result.push(callback(feature, i++, this));
        }
        return result;
    }
};