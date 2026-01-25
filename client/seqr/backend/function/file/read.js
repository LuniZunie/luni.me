import { global } from "../../global.js";
import { CHUNK_SIZE, BUFFER_SIZE, fileStorage, FileStorage } from "./file-storage/storage.js";
import { AddFile } from "./add.js";
import { CreateNotification } from "../../../../module/notification.js";
import { ChunkedProxy } from "./file-storage/proxy.js";
import { ParseFile } from "./parse.js";

export const VALID_EXTENSIONS = /(?<=\.)(bdg|bed|bedgraph|fa|fas|fasta|fastq|fq|gff|gff2|gff3|gtf|sam|vcf|wig|wiggle)$/i;
export async function ReadFile(file) {
    if (!(file instanceof File)) {
        throw new Error("UndoRedoManager:redo(): Invalid file object.");
    }

    const name = file.name;
    if (!VALID_EXTENSIONS.test(name)) {
        const extension = name.split(".").pop()?.toLowerCase() || "<none>";
        CreateNotification(
            `Unsupported file format: .${extension}`,
            "var(--notification-red)"
        );

        throw new Error("UndoRedoManager:redo(): Invalid file extension.");
    }

    if (file.size <= BUFFER_SIZE) {
        return await ReadByMemory(file);
    } else {
        return await ReadByChunks(file);
    }
};

async function ReadByMemory(file) {
    const { element: $el, unique } = AddFile(file);

    try {
        const decoder = new TextDecoder("utf-8"),
              reader = file.stream().getReader();

        let json, cache,
            buffer = "",
            first = true;

        let { done, value } = await reader.read();
        while(!done) {
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop();

            ({ json, cache } = ParseFile(file.name, lines, json, cache, first));
            ({ done, value } = await reader.read());
            first = false;
        }

        buffer += decoder.decode(value, { stream: false });
        if (buffer) {
            const lines = buffer.split("\n");
            ({ json, cache } = ParseFile(file.name, lines, json, cache, first));
            first = false;
        }

        if (!json || !json.format) {
            CreateNotification(`File (${unique}) content does not match any supported genomic format`, "var(--notification-red)");
            return;
        } else if (json.features.length === 0) {
            CreateNotification(`File (${unique}) contains no features`, "var(--notification-red)");
            return;
        }

        $el.classList.remove("disabled");

        const proxy = global.files[unique];
        proxy.data.element = $el;
        proxy.data.format = json.format;

        const metadata = {
            format: json.format,
            directives: Object.entries(json.directives),
            types: json.types,

            minmax: json.minmax,
            colors: json.colors,

            chunks: 1,
            features: json.features.length
        };

        const chunkedProxy = new ChunkedProxy(unique, {
            unique,

            name: proxy.data.name,
            extension: proxy.data.extension,

            size: proxy.data.size,
            date: proxy.data.date,

            element: $el,
        });

        await fileStorage.store(FileStorage.Type.Metadata, {
            fileId: unique,
            data: metadata
        });
        await fileStorage.store(FileStorage.Type.Chunk, {
            fileId: unique,
            chunkIndex: 0,
            data: { features: json.features }
        });

        chunkedProxy.setMetadataCache(metadata);
        global.files[unique] = chunkedProxy;

        return { unique, element: $el, json };
    } catch (error) {
        console.error("Error processing file:", error);
        CreateNotification( `Failed to parse file "${file.name}": ${error.message}`, "var(--notification-red)");

        delete global.files[unique];
        $el.remove();
    }
}

async function ReadByChunks(file) {
    const { element: $el, unique } = AddFile(file);

    const proxy = new ChunkedProxy(unique, {
        unique,

        name: proxy.data.name,
        extension: proxy.data.extension,

        size: proxy.data.size,
        date: proxy.data.date,

        element: $el,
    });
    global.files[unique] = proxy;

    try {
        await ProcessInChunks(file, unique, $el);

        const metadata = proxy.getLoadedMetadata();
        if (!metadata || !metadata.format) {
            CreateNotification(`File (${unique}) content does not match any supported genomic format`, "var(--notification-red)");
            return;
        }

        return { format: metadata.format, unique, element: $el };
    } catch (error) {
        console.error("Error processing file in chunks:", error);
        CreateNotification( `Failed to parse large file "${file.name}": ${error.message}`, "var(--notification-red)");

        delete global.files[unique];
        $el.remove();
    }
}

async function ProcessInChunks(file, fileId, $el) {
    const decoder = new TextDecoder("utf-8"),
          reader = file.stream().getReader();

    let json, cache,
        buffer = "",
        first = true,
        chunk = [],
        chunkIndex = 0,
        features = 0;

    try {
        let { done, value } = await reader.read();
        while (!done) {
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop();

            for (const line of lines) {
                const tempFeatures = json?.features?.length || 0;
                ({ json, cache } = ParseFile([ line ], file.name, json, cache, first));
                first = false;

                const newFeatures = json.features.slice(tempFeatures);
                for (const feature of newFeatures) {
                    chunk.push(feature);
                    features++;

                    if (chunk.length >= CHUNK_SIZE) {
                        await fileStorage.store(FileStorage.Type.Chunk, {
                            fileId,
                            chunkIndex: chunkIndex++,
                            data: { features: chunk }
                        });

                        chunk = [];
                        json.features = [];

                        /* give browser a chance to breathe lol */
                        if (index % 10 === 0) {
                            await new Promise(res => setTimeout(res, 0));
                        }
                    }
                }
            }

            ({ done, value } = await reader.read());
        }

        buffer += decoder.decode(value, { stream: false });
        if (buffer.trim()) {
            const lines = buffer.split("\n");
            for (const line of lines) {
                if (line.trim()) {
                    const tempFeatures = json?.features?.length || 0;
                    ({ json, cache } = ParseFile(file.name, [ line ], json, cache, first));
                    first = false;

                    const newFeatures = json.features.slice(tempFeatures);
                    for (const feature of newFeatures) {
                        chunk.push(feature);
                        features++;
                    }
                }
            }
        }

        if (chunk.length > 0) {
            await fileStorage.store(FileStorage.Type.Chunk, {
                fileId,
                chunkIndex: chunkIndex++,
                data: { features: chunk }
            });
        }

        if (!json || !json.format) {
            CreateNotification(`Large file (${fileId}) content does not match any supported genomic format`, "var(--notification-red)");
            return;
        } else if (json.features.length === 0) {
            CreateNotification(`Large file (${fileId}) contains no features`, "var(--notification-red)");
            return;
        }

        const metadata = {
            format: json.format,
            directives: Object.entries(json.directives),
            types: json.types,

            minmax: json.minmax,
            colors: json.colors,

            chunks: 1,
            features: json.features.length
        };

        await fileStorage.store(FileStorage.Type.Metadata, {
            fileId,
            data: metadata
        });

        const proxy = global.files[fileId];
        proxy.setMetadataCache(metadata);

        $el.classList.remove("disabled");
    } finally {
        reader.releaseLock();
    }
}