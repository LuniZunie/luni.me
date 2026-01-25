import { global } from "./global.js";

import AddFile from "./add-file.js";
import { ParseGenomicFile } from "./parser.js";
import ChunkedFileDataProxy from "./chunked-file-data-proxy.js";
import chunkedStorage from "./chunked-file-storage.js";
import { CreateNotification } from "./notification.js";

const CHUNK_SIZE = 50000; // Features per chunk
const MEMORY_THRESHOLD = 100 * 1024 * 1024; // 100MB - switch to chunked mode for larger files

export default async function ReadFile(file) {
    if (!(file instanceof File)) {
        CreateNotification("Invalid file object", "var(--notification-red)");
        return { error: "INVALID_FILE", code: 0x1 };
    }

    const name = file.name;
    const supportedExtensions = ["gft", "gff", "gff2", "gff3", "gtf", "bed", "bedgraph", "bdg", "wig", "wiggle", "sam", "vcf", "fa", "fasta", "fas", "fq", "fastq"];

    if (!/\.(gft|gff|gff2|gff3|gtf|bed|bedgraph|bdg|wig|wiggle|sam|vcf|fa|fasta|fas|fq|fastq)$/i.test(name)) {
        const extension = name.split(".").pop()?.toLowerCase() || "none";
        CreateNotification(
            `Unsupported file format: .${extension}. Supported formats: ${supportedExtensions.map(ext => `.${ext}`).join(", ")}`,
            "var(--notification-red)",
            5000
        );
        return { error: "UNSUPPORTED_FORMAT", code: 0x2, extension };
    }

    // Use chunked processing for large files
    if (file.size > MEMORY_THRESHOLD) return await ReadFileChunked(file);
    else return await ReadFileInMemory(file);
}

async function ReadFileChunked(file) {
    const { element: $, unique } = AddFile(file);

    // Create chunked file proxy
    const fileProxy = new ChunkedFileDataProxy(unique, {
        unique,
        name: file.name.split(".").slice(0, -1).join("."),
        extension: file.name.split(".").pop(),
        size: file.size,
        date: file.lastModified
    });

    // Replace the file in global.files with our chunked proxy
    global.files[unique] = fileProxy;

    try {
        await ProcessFileInChunks(file, unique, $);

        // Validate that the file was actually parsed successfully
        const metadata = fileProxy.getLoadedMetadata();
        if (!metadata || !metadata.format) {
            throw new Error("File content does not match any supported genomic format");
        }

        return {
            format: metadata.format,
            fileName: unique,
            element: $
        };
    } catch (error) {
        console.error("Error processing file in chunks:", error);

        // Show error notification
        CreateNotification(
            `Failed to parse file "${file.name}": ${error.message}`,
            "var(--notification-red)",
            5000
        );

        // Clean up on error
        delete global.files[unique];
        $.remove();

        return {
            error: "PARSE_ERROR",
            code: 0x3,
            message: error.message,
            fileName: file.name
        };
    }
}

async function ReadFileInMemory(file) {

    const { element: $, unique } = AddFile(file);

    try {
        const decoder = new TextDecoder("utf-8");
        const reader = file.stream().getReader();

        let json, cache;

        let buffer = "";
        let { done, value } = await reader.read();
        while (!done) {
            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split("\n");
            buffer = lines.pop(); // keep the last line in the buffer

            ({ json, cache } = ParseGenomicFile(lines, file.name, json, cache));
            ({ done, value } = await reader.read());
        }

        buffer += decoder.decode(value, { stream: false });
        if (buffer) {
            const lines = buffer.split("\n");
            ({ json, cache } = ParseGenomicFile(lines, file.name, json, cache));
        }

        // Validate that the file was actually parsed successfully
        if (!json || !json.format || json.features.length === 0) {
            throw new Error("File content does not match any supported genomic format or contains no valid features");
        }

        $.classList.remove("disabled");

        // Get the existing file proxy and update it with the parsed data
        const fileProxy = global.files[unique];

        // Set additional properties
        fileProxy.element = $;
        fileProxy.reference = file;
        fileProxy.format = json.format;

        // For small files, we can still use chunked storage but store everything as one chunk
        const metadata = {
            types: json.types,
            metadata: Object.entries(json.directives),
            minmax: cache.minmax,
            colors: cache.colors,
            format: json.format,
            totalChunks: 1,
            totalFeatures: json.features.length
        };

        // Convert to chunked proxy for consistency
        const chunkedProxy = new ChunkedFileDataProxy(unique, {
            unique,
            name: fileProxy.name,
            extension: fileProxy.extension,
            size: fileProxy.size,
            date: fileProxy.date,
            element: $,
            reference: file
        });

        // Store the data
        await chunkedStorage.storeChunk(unique, 0, json.features);
        await chunkedStorage.storeMetadata(unique, metadata);

        // Set metadata in proxy
        chunkedProxy._metadataCache = metadata;

        // Replace with chunked proxy
        global.files[unique] = chunkedProxy;

        return {
            ...json,
            fileName: unique,
            element: $
        };
    } catch (error) {
        console.error("Error processing file in memory:", error);

        // Show error notification
        CreateNotification(
            `Failed to parse file "${file.name}": ${error.message}`,
            "var(--notification-red)",
            5000
        );

        // Clean up on error
        delete global.files[unique];
        $.remove();

        return {
            error: "PARSE_ERROR",
            code: 0x3,
            message: error.message,
            fileName: file.name
        };
    }
}

async function ProcessFileInChunks(file, fileId, $element) {
    const decoder = new TextDecoder("utf-8");
    const reader = file.stream().getReader();

    // Initialize processing state
    let json = {
        format: "GFF3",
        directives: {},
        features: [],
        types: {}
    };
    let cache = { line: 0, ID: {}, minmax: {}, colors: {} };

    let buffer = "";
    let currentChunk = [];
    let chunkIndex = 0;
    let totalFeatures = 0;

    try {
        let { done, value } = await reader.read();

        while (!done) {
            // Decode the chunk
            buffer += decoder.decode(value, { stream: true });

            // Process complete lines
            const lines = buffer.split("\n");
            buffer = lines.pop(); // Keep incomplete line in buffer

            for (const line of lines) {
                // Parse the line
                const oldFeaturesLength = json.features.length;
                ({ json, cache } = ParseGenomicFile([line], file.name, json, cache));

                // If new features were added, add them to current chunk
                const newFeatures = json.features.slice(oldFeaturesLength);
                for (const feature of newFeatures) {
                    currentChunk.push(feature);
                    totalFeatures++;

                    // If chunk is full, save it
                    if (currentChunk.length >= CHUNK_SIZE) {
                        await chunkedStorage.storeChunk(fileId, chunkIndex, currentChunk);
                        chunkIndex++;
                        currentChunk = [];

                        // Clear json.features to free memory
                        json.features = [];

                        // Give browser a chance to breathe
                        if (chunkIndex % 10 === 0) {
                            await new Promise(resolve => setTimeout(resolve, 0));
                        }
                    }
                }
            }

            // Read next chunk
            ({ done, value } = await reader.read());
        }

        // Process final buffer
        buffer += decoder.decode(value, { stream: false });
        if (buffer.trim()) {
            const lines = buffer.split("\n");
            for (const line of lines) {
                if (line.trim()) {
                    const oldFeaturesLength = json.features.length;
                    ({ json, cache } = ParseGenomicFile([line], file.name, json, cache));

                    const newFeatures = json.features.slice(oldFeaturesLength);
                    for (const feature of newFeatures) {
                        currentChunk.push(feature);
                        totalFeatures++;
                    }
                }
            }
        }

        // Save final chunk if it has data
        if (currentChunk.length > 0) {
            await chunkedStorage.storeChunk(fileId, chunkIndex, currentChunk);
            chunkIndex++;
        }

        // Validate that the file was actually parsed successfully
        if (totalFeatures === 0 || !json.format) {
            throw new Error("File content does not match any supported genomic format or contains no valid features");
        }

        // Store metadata
        const metadata = {
            types: json.types,
            metadata: Object.entries(json.directives),
            minmax: cache.minmax,
            colors: cache.colors,
            format: json.format,
            totalChunks: chunkIndex,
            totalFeatures: totalFeatures
        };

        await chunkedStorage.storeMetadata(fileId, metadata);

        // Set metadata in proxy
        const fileProxy = global.files[fileId];
        fileProxy._metadataCache = metadata;

        // Update UI
        $element.classList.remove("disabled");

        console.log(`File processed: ${totalFeatures} features in ${chunkIndex} chunks`);

    } finally {
        reader.releaseLock();
    }
}