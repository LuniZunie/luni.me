/**
 * Chunked file storage manager for processing large files in memory-efficient chunks
 * Processes files piece by piece to avoid memory overflow while maintaining functionality
 */

const DB_NAME = "seqr-chunked-storage";
const DB_VERSION = 1;
const CHUNKS_STORE = "file-chunks";
const METADATA_STORE = "file-metadata";

// Configuration for chunking
const CHUNK_SIZE = 50000; // Number of features per chunk
const BUFFER_SIZE = 1024 * 1024; // 1MB buffer for reading

class ChunkedFileStorage {
    constructor() {
        this.db = null;
        this.initPromise = this.init();
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Store for file chunks
                if (!db.objectStoreNames.contains(CHUNKS_STORE)) {
                    const chunksStore = db.createObjectStore(CHUNKS_STORE, { keyPath: [ "fileId", "chunkIndex" ] });
                    chunksStore.createIndex("fileId", "fileId", { unique: false });
                }

                // Store for file metadata (types, minmax, overall info)
                if (!db.objectStoreNames.contains(METADATA_STORE))
                    db.createObjectStore(METADATA_STORE, { keyPath: "fileId" });
            };
        });
    }

    async ensureReady() {
        if (!this.db) {
            await this.initPromise;
        }
    }

    async storeChunk(fileId, chunkIndex, features) {
        await this.ensureReady();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([ CHUNKS_STORE ], "readwrite");
            const store = transaction.objectStore(CHUNKS_STORE);

            const request = store.put({
                fileId,
                chunkIndex,
                features,
                timestamp: Date.now()
            });

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async storeMetadata(fileId, metadata) {
        await this.ensureReady();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([ METADATA_STORE ], "readwrite");
            const store = transaction.objectStore(METADATA_STORE);

            const request = store.put({
                fileId,
                types: this.serializeTypes(metadata.types || {}),
                metadata: metadata.metadata || [],
                minmax: metadata.minmax || {},
                colors: metadata.colors || {},
                format: metadata.format || "",
                totalChunks: metadata.totalChunks || 0,
                totalFeatures: metadata.totalFeatures || 0,
                timestamp: Date.now()
            });

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getMetadata(fileId) {
        await this.ensureReady();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([ METADATA_STORE ], "readonly");
            const store = transaction.objectStore(METADATA_STORE);

            const request = store.get(fileId);

            request.onsuccess = () => {
                if (request.result) {
                    const data = request.result;
                    resolve({
                        types: this.deserializeTypes(data.types),
                        metadata: data.metadata,
                        minmax: data.minmax,
                        colors: data.colors,
                        format: data.format,
                        totalChunks: data.totalChunks,
                        totalFeatures: data.totalFeatures
                    });
                } else resolve(null);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async getChunk(fileId, chunkIndex) {
        await this.ensureReady();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([ CHUNKS_STORE ], "readonly");
            const store = transaction.objectStore(CHUNKS_STORE);

            const request = store.get([ fileId, chunkIndex ]);

            request.onsuccess = () => resolve(request.result ? request.result.features : null);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllChunks(fileId) {
        await this.ensureReady();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([ CHUNKS_STORE ], "readonly");
            const store = transaction.objectStore(CHUNKS_STORE);
            const index = store.index("fileId");

            const request = index.getAll(fileId);

            request.onsuccess = () => {
                const chunks = request.result.sort((a, b) => a.chunkIndex - b.chunkIndex);
                const allFeatures = [];
                chunks.forEach(chunk => allFeatures.push(...chunk.features));
                resolve(allFeatures);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async getChunksInRange(fileId, startChunk, endChunk) {
        await this.ensureReady();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([ CHUNKS_STORE ], "readonly");
            const store = transaction.objectStore(CHUNKS_STORE);

            const requests = [];
            for (let i = startChunk; i <= endChunk; i++)
                requests.push(new Promise((res, rej) => {
                    const req = store.get([ fileId, i ]);
                    req.onsuccess = () => res(req.result ? req.result.features : []);
                    req.onerror = () => rej(req.error);
                }));

            Promise.all(requests).then(chunks => {
                const allFeatures = [];
                chunks.forEach(chunk => allFeatures.push(...chunk));
                resolve(allFeatures);
            }).catch(reject);
        });
    }

    async deleteFile(fileId) {
        await this.ensureReady();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([ CHUNKS_STORE, METADATA_STORE ], "readwrite");
            const chunksStore = transaction.objectStore(CHUNKS_STORE);
            const metadataStore = transaction.objectStore(METADATA_STORE);

            // Delete metadata
            metadataStore.delete(fileId);

            // Delete all chunks for this file
            const index = chunksStore.index("fileId");
            const request = index.openCursor(fileId);

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                } else resolve();
            };

            request.onerror = () => reject(request.error);
        });
    }

    async clearAllData() {
        await this.ensureReady();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([ CHUNKS_STORE, METADATA_STORE ], "readwrite");

            const clearChunks = new Promise((res, rej) => {
                const req = transaction.objectStore(CHUNKS_STORE).clear();
                req.onsuccess = () => res();
                req.onerror = () => rej(req.error);
            });

            const clearMetadata = new Promise((res, rej) => {
                const req = transaction.objectStore(METADATA_STORE).clear();
                req.onsuccess = () => res();
                req.onerror = () => rej(req.error);
            });

            Promise.all([ clearChunks, clearMetadata ]).then(() => resolve()).catch(reject);
        });
    }

    // Helper methods to handle Set serialization for types
    serializeTypes(types) {
        const serialized = {};
        for (const [ key, value ] of Object.entries(types)) {
            if (value instanceof Set) serialized[key] = Array.from(value);
            else serialized[key] = value;
        }
        return serialized;
    }

    deserializeTypes(types) {
        const deserialized = {};
        for (const [ key, value ] of Object.entries(types)) {
            if (Array.isArray(value)) deserialized[key] = new Set(value);
            else deserialized[key] = value;
        }
        return deserialized;
    }
}

// Create singleton instance
const chunkedStorage = new ChunkedFileStorage();

export default chunkedStorage;
