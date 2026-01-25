const DB_NAME = "SeqR:file-storage",
      DB_VERSION = 1;

const CHUNKS_STORE = "chunks",
      METADATA_STORE = "metadata";

const CHUNK_SIZE = 5e+4,
      BUFFER_SIZE = 1024 ** 2 * 100; /* 100MB */

class FileStorage {
    static Type = Object.freeze({
        Chunk: Symbol("type:chunk"),
        Metadata: Symbol("type:metadata")
    });

    #db = null;
    #promise;

    constructor() {
        this.#promise = this.init();
    }

    async init() {
        return new Promise((res, rej) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);

            req.onerror = () => rej(req.error);
            req.onsuccess = () => {
                this.#db = req.result;
                res();
            };
            req.onupgradeneeded = e => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(CHUNKS_STORE)) {
                    const store = db.createObjectStore(CHUNKS_STORE, { keyPath: [ "file_id", "chunk_index" ] });
                    store.createIndex("file_id", "file_id", { unique: false });
                }

                if (!db.objectStoreNames.contains(METADATA_STORE)) {
                    db.createObjectStore(METADATA_STORE, { keyPath: "file_id" });
                }
            }
        });
    }

    async ready() {
        if (!this.#db) {
            await this.#promise;
        }
    }

    async store(type, data) {
        await this.ready();

        return new Promise((res, rej) => {
            switch (type) {
                case FileStorage.Type.Chunk: {
                    const transaction = this.#db.transaction([ CHUNKS_STORE ], "readwrite"),
                          store = transaction.objectStore(CHUNKS_STORE);

                    const req = store.put({
                        file_id: data.fileId,
                        chunk_index: data.chunkIndex,
                        ...data.data,
                        timestamp: Date.now()
                    });

                    req.onsuccess = () => res();
                    req.onerror = () => rej(req.error);
                } break;
                case FileStorage.Type.Metadata: {
                    const transaction = this.#db.transaction([ METADATA_STORE ], "readwrite"),
                          store = transaction.objectStore(METADATA_STORE);

                    const req = store.put({
                        file_id: data.fileId,
                        ...data.data,
                        timestamp: Date.now()
                    });

                    req.onsuccess = () => res();
                    req.onerror = () => rej(req.error);
                } break;
            }
        });
    }

    async read(type, data) {
        await this.ready();

        return new Promise((res, rej) => {
            switch (type) {
                case FileStorage.Type.Chunk: {
                    const transaction = this.#db.transaction([ CHUNKS_STORE ], "readonly"),
                          store = transaction.objectStore(CHUNKS_STORE);

                    const req = store.get([ data.fileId, data.chunkIndex ]);
                    req.onsuccess = () => {
                        if (req.result) {
                            res(req.result.features);
                        } else {
                            res(null);
                        }
                    };
                    req.onerror = () => rej(req.error);
                } break;
                case FileStorage.Type.Metadata: {
                    const transaction = this.#db.transaction([ METADATA_STORE ], "readonly"),
                          store = transaction.objectStore(METADATA_STORE);

                    const req = store.get([ data.fileId ]);
                    req.onsuccess = () => {
                        if (req.result) {
                            res(req.result);
                        } else {
                            res(null);
                        }
                    };
                    req.onerror = () => rej(req.error);
                } break;
            }
        });
    }

    async delete(fileId) {
        await this.ready();

        return new Promise((res, rej) => {
            const transaction = this.#db.transaction([ CHUNKS_STORE, METADATA_STORE ], "readwrite"),
                  chunksStore = transaction.objectStore(CHUNKS_STORE),
                  metadataStore = transaction.objectStore(METADATA_STORE);

            metadataStore.delete(fileId);

            const index = chunksStore.index("file_id"),
                  req = index.openCursor(fileId);

            req.onsuccess = e => {
                const cursor = e.target.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                } else {
                    res();
                }
            };
            req.onerror = () => rej(req.error);
        });
    }

    async clear() {
        await this.ready();

        return new Promise((res, rej) => {
            const transaction = this.#db.transaction([ CHUNKS_STORE, METADATA_STORE ], "readwrite");

            const clearChunks = new Promise((res2, rej2) => {
                const req = transaction.objectStore(CHUNKS_STORE).clear();
                req.onsuccess = () => res2();
                req.onerror = () => rej2(req.error);
            });

            const clearMetadata = new Promise((res2, rej2) => {
                const req = transaction.objectStore(METADATA_STORE).clear();
                req.onsuccess = () => res2();
                req.onerror = () => rej2(req.error);
            });

            Promise.all([ clearChunks, clearMetadata ])
                .then(() => res)
                .catch(rej);
        });
    }
}

const fileStorage = new FileStorage();
export { FileStorage, fileStorage, CHUNK_SIZE, BUFFER_SIZE };