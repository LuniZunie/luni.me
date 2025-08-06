import chunkedStorage from "./chunked-file-storage.js";

/**
 * Chunked file data proxy that processes large files in memory-efficient chunks
 * Maintains the same interface while loading data on-demand
 */
class ChunkedFileDataProxy {
    constructor(fileId, baseData) {
        this.fileId = fileId;
        this._metadataCache = null;
        this._chunkCache = new Map(); // Cache for loaded chunks
        this._loadingPromises = new Map(); // Track ongoing loads

        // Store non-large data directly
        Object.assign(this, baseData);

        // Setup lazy-loading proxies
        this._setupProxies();
    }

    _setupProxies() {
        // Features proxy - returns a virtual array that loads chunks on demand
        Object.defineProperty(this, 'features', {
            get: () => {
                return new ChunkedFeaturesArray(this.fileId, this);
            },
            set: (value) => {
                // This is handled during file processing
                console.warn('Direct assignment to features not supported in chunked mode');
            },
            enumerable: true,
            configurable: true
        });

        // Types proxy
        Object.defineProperty(this, 'types', {
            get: () => {
                if (this._metadataCache?.types)
                    return this._metadataCache.types;
                throw new Error(`File metadata not loaded for ${this.fileId}. Use await loadMetadata() first.`);
            },
            set: (value) => {
                this._metadataCache = this._metadataCache || {};
                this._metadataCache.types = value;
            },
            enumerable: true,
            configurable: true
        });

        // Metadata proxy
        Object.defineProperty(this, 'metadata', {
            get: () => {
                if (this._metadataCache?.metadata)
                    return this._metadataCache.metadata;
                throw new Error(`File metadata not loaded for ${this.fileId}. Use await loadMetadata() first.`);
            },
            set: (value) => {
                this._metadataCache = this._metadataCache || {};
                this._metadataCache.metadata = value;
            },
            enumerable: true,
            configurable: true
        });

        // Minmax proxy
        Object.defineProperty(this, 'minmax', {
            get: () => {
                if (this._metadataCache?.minmax)
                    return this._metadataCache.minmax;
                throw new Error(`File metadata not loaded for ${this.fileId}. Use await loadMetadata() first.`);
            },
            set: (value) => {
                this._metadataCache = this._metadataCache || {};
                this._metadataCache.minmax = value;
            },
            enumerable: true,
            configurable: true
        });

        // Colors proxy
        Object.defineProperty(this, 'colors', {
            get: () => {
                if (this._metadataCache?.colors)
                    return this._metadataCache.colors;
                throw new Error(`File metadata not loaded for ${this.fileId}. Use await loadMetadata() first.`);
            },
            set: (value) => {
                this._metadataCache = this._metadataCache || {};
                this._metadataCache.colors = value;
            },
            enumerable: true,
            configurable: true
        });
    }

    async loadMetadata() {
        if (this._loadingPromises.has('metadata'))
            return this._loadingPromises.get('metadata');

        if (this._metadataCache)
            return this._metadataCache;

        const promise = chunkedStorage.getMetadata(this.fileId);
        this._loadingPromises.set('metadata', promise);

        try {
            this._metadataCache = await promise;
            this._loadingPromises.delete('metadata');
            return this._metadataCache;
        } catch (error) {
            this._loadingPromises.delete('metadata');
            throw error;
        }
    }

    async loadChunk(chunkIndex) {
        const cacheKey = `chunk-${chunkIndex}`;

        if (this._loadingPromises.has(cacheKey))
            return this._loadingPromises.get(cacheKey);

        if (this._chunkCache.has(chunkIndex))
            return this._chunkCache.get(chunkIndex);

        const promise = chunkedStorage.getChunk(this.fileId, chunkIndex);
        this._loadingPromises.set(cacheKey, promise);

        try {
            const chunk = await promise;
            this._chunkCache.set(chunkIndex, chunk || []);
            this._loadingPromises.delete(cacheKey);
            return this._chunkCache.get(chunkIndex);
        } catch (error) {
            this._loadingPromises.delete(cacheKey);
            throw error;
        }
    }

    async getAllFeatures() {
        return await chunkedStorage.getAllChunks(this.fileId);
    }

    async getFeaturesInRange(startChunk, endChunk) {
        return await chunkedStorage.getChunksInRange(this.fileId, startChunk, endChunk);
    }

    async deleteFileData() {
        await chunkedStorage.deleteFile(this.fileId);
        this._metadataCache = null;
        this._chunkCache.clear();
        this._loadingPromises.clear();
    }

    isMetadataLoaded() {
        return this._metadataCache !== null;
    }

    isChunkLoaded(chunkIndex) {
        return this._chunkCache.has(chunkIndex);
    }

    getLoadedMetadata() {
        return this._metadataCache;
    }

    // For backward compatibility
    async loadFileData() {
        return await this.loadMetadata();
    }

    isDataLoaded() {
        return this.isMetadataLoaded();
    }

    async saveFileData() {
        if (this._metadataCache)
            await chunkedStorage.storeMetadata(this.fileId, this._metadataCache);
    }
}

/**
 * Virtual array that loads chunks on demand while maintaining array-like interface
 */
class ChunkedFeaturesArray {
    constructor(fileId, proxy) {
        this.fileId = fileId;
        this.proxy = proxy;
        this._virtualLength = null;
    }

    async _ensureMetadata() {
        if (!this.proxy.isMetadataLoaded())
            await this.proxy.loadMetadata()
    }

    get length() {
        if (this._virtualLength !== null)
            return this._virtualLength;


        if (this.proxy.isMetadataLoaded())
            return this.proxy.getLoadedMetadata().features || 0;

        throw new Error(`Cannot get length: metadata not loaded for ${this.fileId}`);
    }

    async at(index) {
        await this._ensureMetadata();
        const metadata = this.proxy.getLoadedMetadata();
        const chunkSize = 50000; // Should match CHUNK_SIZE in storage
        const chunkIndex = Math.floor(index / chunkSize);
        const indexInChunk = index % chunkSize;

        const chunk = await this.proxy.loadChunk(chunkIndex);
        return chunk[indexInChunk] || null;
    }

    async slice(start = 0, end = this.length) {
        await this._ensureMetadata();
        const chunkSize = 50000;
        const startChunk = Math.floor(start / chunkSize);
        const endChunk = Math.floor((end - 1) / chunkSize);

        if (startChunk === endChunk) {
            // Single chunk
            const chunk = await this.proxy.loadChunk(startChunk);
            const startInChunk = start % chunkSize;
            const endInChunk = end % chunkSize;
            return chunk.slice(startInChunk, endInChunk || undefined);
        } else {
            // Multiple chunks
            const features = await this.proxy.getFeaturesInRange(startChunk, endChunk);
            const startOffset = start - (startChunk * chunkSize);
            const endOffset = end - (startChunk * chunkSize);
            return features.slice(startOffset, endOffset);
        }
    }

    async *[Symbol.asyncIterator]() {
        await this._ensureMetadata();
        const metadata = this.proxy.getLoadedMetadata();
        const chunkSize = 50000;
        const totalChunks = metadata.totalChunks || 0;

        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
            const chunk = await this.proxy.loadChunk(chunkIndex);
            for (const feature of chunk)
                yield feature;
        }
    }

    // For synchronous iteration over loaded chunks (for compatibility)
    *[Symbol.iterator]() {
        // This will only work if chunks are already loaded
        // Should be used carefully
        console.warn('Synchronous iteration over chunked features - may not include all data');
        for (const [chunkIndex, chunk] of this.proxy._chunkCache)
            for (const feature of chunk)
                yield feature;
    }

    // Add forEach for compatibility
    async forEach(callback) {
        let index = 0;
        for await (const feature of this)
            callback(feature, index++, this);
    }

    // Add map for compatibility
    async map(callback) {
        const results = [];
        let index = 0;
        for await (const feature of this)
            results.push(callback(feature, index++, this));
        return results;
    }
}

export default ChunkedFileDataProxy;
