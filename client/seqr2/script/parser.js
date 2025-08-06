// Format detection and parsing utilities
const FORMAT_PATTERNS = {
    GFF3: /##gff-version\s+3/i,
    GFF2: /##gff-version\s+2/i,
    GTF: /##gtf-version|gene_id\s+"|transcript_id\s+"/i,
    BED: /^(track|browser|\w+\s+\d+\s+\d+)/i,
    BEDGRAPH: /^(track|variableStep|fixedStep|#bedGraph)/i,
    WIG: /^(track|variableStep|fixedStep)/i,
    SAM: /^@(HD|SQ|RG|PG|CO)/,
    VCF: /^##fileformat=VCF/i,
    FASTA: /^>/,
    FASTQ: /^@[\w\-\.]+/
};

// Additional format-specific metadata patterns
const METADATA_PATTERNS = {
    GFF3: {
        version: /##gff-version\s+([0-9\.]+)/i,
        sequenceRegion: /##sequence-region\s+(\S+)\s+(\d+)\s+(\d+)/i,
        species: /##species\s+(.+)/i
    },
    VCF: {
        fileformat: /##fileformat=VCF([0-9\.]+)/i,
        reference: /##reference=(.+)/i,
        contig: /##contig=<ID=([^,>]+)/i
    },
    SAM: {
        version: /@HD.*VN:([^\s\t]+)/i,
        reference: /@SQ.*SN:([^\s\t]+).*LN:(\d+)/i,
        readGroup: /@RG.*ID:([^\s\t]+)/i
    }
};

function DetectFormat(lines, filename = "") {
    // Check file extension first for quick detection
    const ext = filename.toLowerCase().split(".").pop();
    if (ext === "gtf") return "GTF";
    if (ext === "bed") return "BED";
    if (ext === "gff3") return "GFF3";
    if (ext === "gff2" || ext === "gff") return "GFF2";
    if (ext === "bedgraph" || ext === "bdg") return "BEDGRAPH";
    if (ext === "wig" || ext === "wiggle") return "WIG";
    if (ext === "sam") return "SAM";
    if (ext === "vcf") return "VCF";
    if (ext === "fa" || ext === "fasta" || ext === "fas") return "FASTA";
    if (ext === "fq" || ext === "fastq") return "FASTQ";

    // Check content for format indicators
    for (const line of lines.slice(0, 50)) { // Check first 50 lines for headers
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        // Check header patterns
        if (trimmedLine.startsWith("#") || trimmedLine.startsWith("@")) {
            for (const [format, pattern] of Object.entries(FORMAT_PATTERNS)) {
                if (pattern.test(trimmedLine)) return format;
            }
        } else if (trimmedLine && !trimmedLine.startsWith("#")) {
            // Check data line structure for format detection
            const cols = trimmedLine.split(/\s+/);

            // FASTA format check
            if (trimmedLine.startsWith(">")) return "FASTA";

            // FASTQ format check
            if (trimmedLine.startsWith("@") && /^@[\w\-\.]+/.test(trimmedLine)) return "FASTQ";

            // Tab-delimited formats
            const tabCols = trimmedLine.split("\t");
            if (tabCols.length >= 3) {
                // BED format (3-12 columns)
                if (tabCols.length <= 12) {
                    const [chrom, start, end] = tabCols;
                    if (/^[\w\-\.]+$/.test(chrom) && /^\d+$/.test(start) && /^\d+$/.test(end)) {
                        const startNum = Number(start);
                        const endNum = Number(end);
                        // BED is 0-based, usually start < end
                        if (startNum >= 0 && endNum > startNum) {
                            return "BED";
                        }
                    }
                }

                // GFF/GTF format (exactly 9 columns)
                if (tabCols.length === 9) {
                    const [seqid, source, type, start, end, score, strand, phase, attrs] = tabCols;
                    if (/^\d+$/.test(start) && /^\d+$/.test(end) && /^[+\-\.]$/.test(strand)) {
                        // Check attributes for GTF vs GFF distinction
                        if (attrs && (attrs.includes("gene_id") || attrs.includes("transcript_id"))) {
                            return "GTF";
                        }
                        return "GFF3"; // Default to GFF3 for 9-column format
                    }
                }

                // BEDGRAPH format (4 columns: chrom, start, end, value)
                if (tabCols.length === 4) {
                    const [chrom, start, end, value] = tabCols;
                    if (/^[\w\-\.]+$/.test(chrom) && /^\d+$/.test(start) &&
                        /^\d+$/.test(end) && /^-?\d*\.?\d+$/.test(value)) {
                        return "BEDGRAPH";
                    }
                }
            }

            // SAM format check (11+ columns, specific patterns)
            if (tabCols.length >= 11) {
                const [qname, flag, rname, pos, mapq, cigar] = tabCols;
                if (/^\d+$/.test(flag) && /^\d+$/.test(pos) && /^\d+$/.test(mapq)) {
                    return "SAM";
                }
            }

            // Only check first meaningful data line
            break;
        }
    }

    return "GFF3"; // Default fallback
}

function ParseGenomicFile(lines, filename = "", json = null, cache = null) {
    const format = DetectFormat(lines, filename);

    // Initialize default json and cache if not provided
    json ??= {
        format,
        directives: {},
        features: [],
        types: {}
    };
    cache ??= { line: 0, ID: {}, minmax: {}, colors: {} };

    // Update format in json
    json.format = format;

    switch (format) {
        case "GFF3":
            return ParseGFF3(lines, json, cache);
        case "GFF2":
            return ParseGFF2(lines, json, cache);
        case "GTF":
            return ParseGTF(lines, json, cache);
        case "BED":
            return ParseBED(lines, json, cache);
        case "BEDGRAPH":
            return ParseBEDGRAPH(lines, json, cache);
        case "WIG":
            return ParseWIG(lines, json, cache);
        case "SAM":
            return ParseSAM(lines, json, cache);
        case "VCF":
            return ParseVCF(lines, json, cache);
        case "FASTA":
            return ParseFASTA(lines, json, cache);
        case "FASTQ":
            return ParseFASTQ(lines, json, cache);
        default:
            return ParseGFF3(lines, json, cache); // Fallback
    }
}

function ParseGFF3(lines, json, cache) {
    if (!Array.isArray(lines))
        throw new TypeError("ParseGFF3(lines: string[], json: object, cache: object): <lines> not \"string[]\"");

    const nullify = (v, fn = v => v) => v === "." ? null : fn(v);

    for (const line of lines) {
        if (typeof line !== "string")
            throw new TypeError("ParseGFF3(line: string, json: object, cache: object): <line> not \"string\"");

        if (line.startsWith("##")) {
            const [k, ...v] = line.slice(2).split(" ");
            if (json.directives[k]) json.directives[k].push(v.join(" "));
            else json.directives[k] = [v.join(" ")];
        } else if (!(line.startsWith("#") || line.trim() === "")) {
            const cols = line.split("\t");
            if (cols.length !== 9) continue;

            const [seqid, source, type, start, end, score, strand, phase, attrs] = cols;
            const feature = {
                line: ++cache.line,
                seqid: nullify(seqid),
                source: nullify(source),
                type: nullify(type),
                start: nullify(start, Number),
                end: nullify(end, Number),
                score: nullify(score, Number),
                strand: nullify(strand),
                phase: nullify(phase, Number),
                attributes: {}
            };

            if (!(type in json.types)) json.types[type] = new Set();
            json.types[type].add(strand);

            if (nullify(attrs)) {
                const attrPairs = attrs.split(";");
                for (const pair of attrPairs) {
                    const [k, v] = pair.split("=");
                    if (k && v) feature.attributes[k] = decodeURIComponent(v);
                }
            }

            cache.minmax[feature.type] ??= {};
            const minmax = cache.minmax[feature.type][strand] ??= { min: feature.start, max: feature.end };
            if (feature.start < minmax.min) minmax.min = feature.start;
            if (feature.end > minmax.max) minmax.max = feature.end;

            const ID = feature.attributes.ID;
            if (ID) {
                if (cache.ID[ID]) cache.ID[ID].push(feature);
                else {
                    const array = [feature];
                    json.features.push(array);
                    cache.ID[ID] = array;
                }
            } else {
                json.features.push([feature]);
            }
        }
    }

    return { json, cache };
}

function ParseGFF2(lines, json, cache) {
    const nullify = (v, fn = v => v) => v === "." ? null : fn(v);

    for (const line of lines) {
        if (line.startsWith("##")) {
            const [k, ...v] = line.slice(2).split(" ");
            if (json.directives[k]) json.directives[k].push(v.join(" "));
            else json.directives[k] = [v.join(" ")];
        } else if (!(line.startsWith("#") || line.trim() === "")) {
            const cols = line.split("\t");
            if (cols.length !== 9) continue;

            const [seqid, source, type, start, end, score, strand, phase, attrs] = cols;
            const feature = {
                line: ++cache.line,
                seqid: nullify(seqid),
                source: nullify(source),
                type: nullify(type),
                start: nullify(start, Number),
                end: nullify(end, Number),
                score: nullify(score, Number),
                strand: nullify(strand),
                phase: nullify(phase, Number),
                attributes: {}
            };

            if (!(type in json.types)) json.types[type] = new Set();
            json.types[type].add(strand);

            // GFF2 uses space-separated key-value pairs
            if (nullify(attrs)) {
                const attrPairs = attrs.split(";");
                for (const pair of attrPairs) {
                    const trimmed = pair.trim();
                    if (trimmed.includes(" ")) {
                        const [k, ...v] = trimmed.split(" ");
                        feature.attributes[k] = v.join(" ").replace(/"/g, "");
                    }
                }
            }

            cache.minmax[feature.type] ??= {};
            const minmax = cache.minmax[feature.type][strand] ??= { min: feature.start, max: feature.end };
            if (feature.start < minmax.min) minmax.min = feature.start;
            if (feature.end > minmax.max) minmax.max = feature.end;

            json.features.push([feature]);
        }
    }

    return { json, cache };
}

function ParseGTF(lines, json, cache) {
    const nullify = (v, fn = v => v) => v === "." ? null : fn(v);

    for (const line of lines) {
        if (line.startsWith("##")) {
            const [k, ...v] = line.slice(2).split(" ");
            if (json.directives[k]) json.directives[k].push(v.join(" "));
            else json.directives[k] = [v.join(" ")];
        } else if (!(line.startsWith("#") || line.trim() === "")) {
            const cols = line.split("\t");
            if (cols.length !== 9) continue;

            const [seqid, source, type, start, end, score, strand, phase, attrs] = cols;
            const feature = {
                line: ++cache.line,
                seqid: nullify(seqid),
                source: nullify(source),
                type: nullify(type),
                start: nullify(start, Number),
                end: nullify(end, Number),
                score: nullify(score, Number),
                strand: nullify(strand),
                phase: nullify(phase, Number),
                attributes: {}
            };

            if (!(type in json.types)) json.types[type] = new Set();
            json.types[type].add(strand);

            // GTF uses semicolon-separated key "value" pairs
            if (nullify(attrs)) {
                const attrPairs = attrs.split(";");
                for (const pair of attrPairs) {
                    const trimmed = pair.trim();
                    const match = trimmed.match(/^(\w+)\s+"([^"]*)"/) || trimmed.match(/^(\w+)\s+(\S+)/);
                    if (match) {
                        const [, k, v] = match;
                        feature.attributes[k] = v;
                    }
                }
            }

            cache.minmax[feature.type] ??= {};
            const minmax = cache.minmax[feature.type][strand] ??= { min: feature.start, max: feature.end };
            if (feature.start < minmax.min) minmax.min = feature.start;
            if (feature.end > minmax.max) minmax.max = feature.end;

            // Group by gene_id or transcript_id for GTF
            const geneId = feature.attributes.gene_id || feature.attributes.transcript_id;
            if (geneId) {
                if (cache.ID[geneId]) cache.ID[geneId].push(feature);
                else {
                    const array = [feature];
                    json.features.push(array);
                    cache.ID[geneId] = array;
                }
            } else {
                json.features.push([feature]);
            }
        }
    }

    return { json, cache };
}

function ParseBED(lines, json, cache) {
    const nullify = (v, fn = v => v) => v === "." ? null : fn(v);

    for (const line of lines) {
        if (line.startsWith("#") || line.startsWith("track") || line.startsWith("browser")) {
            // Handle BED track/browser lines as directives
            if (line.startsWith("track") || line.startsWith("browser")) {
                const [directive, ...params] = line.split(" ");
                if (json.directives[directive]) json.directives[directive].push(params.join(" "));
                else json.directives[directive] = [params.join(" ")];
            }
            continue;
        }

        if (line.trim() === "") continue;

        const cols = line.split("\t");
        if (cols.length < 3) continue; // BED requires at least 3 columns

        // BED format columns (up to 12):
        // 1. chrom - chromosome name
        // 2. chromStart - start position (0-based)
        // 3. chromEnd - end position (1-based, exclusive)
        // 4. name - feature name
        // 5. score - score (0-1000)
        // 6. strand - strand (+/-)
        // 7. thickStart - thick region start (0-based)
        // 8. thickEnd - thick region end (1-based, exclusive)
        // 9. itemRgb - RGB color value
        // 10. blockCount - number of blocks
        // 11. blockSizes - comma-separated block sizes
        // 12. blockStarts - comma-separated block starts (relative to chromStart)
        const [chrom, chromStart, chromEnd, name, score, strand, thickStart, thickEnd, itemRgb, blockCount, blockSizes, blockStarts] = cols;

        const feature = {
            line: ++cache.line,
            seqid: chrom,
            source: "BED",
            type: "region",
            start: Number(chromStart) + 1, // BED is 0-based, convert to 1-based
            end: Number(chromEnd),
            score: cols.length > 4 ? nullify(score, Number) : null,
            strand: cols.length > 5 ? nullify(strand) : null,
            phase: null,
            attributes: {}
        };

        // Add BED-specific attributes (convert coordinates from 0-based to 1-based as needed)
        if (cols.length > 3 && name) feature.attributes.Name = name;
        if (cols.length > 6 && thickStart !== "." && thickStart !== "") feature.attributes.thickStart = Number(thickStart) + 1; // Convert 0-based to 1-based
        if (cols.length > 7 && thickEnd !== "." && thickEnd !== "") feature.attributes.thickEnd = Number(thickEnd); // Already 1-based exclusive
        if (cols.length > 8 && itemRgb !== "." && itemRgb !== "") {
            feature.attributes.itemRgb = itemRgb;

            cache.colors[feature.type] ??= {};
            cache.colors[feature.type][feature.strand] ??= true;
        }
        if (cols.length > 9 && blockCount !== "." && blockCount !== "") feature.attributes.blockCount = Number(blockCount);
        if (cols.length > 10 && blockSizes !== "." && blockSizes !== "") feature.attributes.blockSizes = blockSizes;
        if (cols.length > 11 && blockStarts !== "." && blockStarts !== "") feature.attributes.blockStarts = blockStarts;

        const type = "region";
        if (!(type in json.types)) json.types[type] = new Set();
        json.types[type].add(feature.strand);

        cache.minmax[feature.type] ??= {};
        const minmax = cache.minmax[feature.type][feature.strand] ??= { min: feature.start, max: feature.end };
        if (feature.start < minmax.min) minmax.min = feature.start;
        if (feature.end > minmax.max) minmax.max = feature.end;

        json.features.push([feature]);
    }

    return { json, cache };
}

function ParseBEDGRAPH(lines, json, cache) {
    for (const line of lines) {
        if (line.startsWith("#") || line.startsWith("track") || line.startsWith("browser")) {
            // Handle track/browser lines as directives
            if (line.startsWith("track") || line.startsWith("browser")) {
                const [directive, ...params] = line.split(" ");
                if (json.directives[directive]) json.directives[directive].push(params.join(" "));
                else json.directives[directive] = [params.join(" ")];
            }
            continue;
        }

        if (line.trim() === "") continue;

        const cols = line.split("\t");
        if (cols.length !== 4) continue; // BEDGRAPH requires exactly 4 columns

        const [chrom, chromStart, chromEnd, dataValue] = cols;

        const feature = {
            line: ++cache.line,
            seqid: chrom,
            source: "BEDGRAPH",
            type: "signal",
            start: Number(chromStart) + 1, // BEDGRAPH is 0-based, convert to 1-based
            end: Number(chromEnd),
            score: Number(dataValue),
            strand: null,
            phase: null,
            attributes: { value: Number(dataValue) }
        };

        const type = "signal";
        if (!(type in json.types)) json.types[type] = new Set();
        json.types[type].add(null);

        cache.minmax[feature.type] ??= {};
        const minmax = cache.minmax[feature.type][null] ??= { min: feature.start, max: feature.end };
        if (feature.start < minmax.min) minmax.min = feature.start;
        if (feature.end > minmax.max) minmax.max = feature.end;

        json.features.push([feature]);
    }

    return { json, cache };
}

function ParseWIG(lines, json, cache) {
    let currentStep = null;
    let currentSpan = 1;
    let currentChrom = null;
    let currentPos = 1;

    for (const line of lines) {
        if (line.startsWith("#") || line.startsWith("track") || line.startsWith("browser")) {
            // Handle track/browser lines as directives
            if (line.startsWith("track") || line.startsWith("browser")) {
                const [directive, ...params] = line.split(" ");
                if (json.directives[directive]) json.directives[directive].push(params.join(" "));
                else json.directives[directive] = [params.join(" ")];
            }
            continue;
        }

        if (line.trim() === "") continue;

        // Handle variableStep and fixedStep declarations
        if (line.startsWith("variableStep") || line.startsWith("fixedStep")) {
            const params = line.split(/\s+/);
            currentStep = params[0];

            for (const param of params.slice(1)) {
                if (param.startsWith("chrom=")) currentChrom = param.split("=")[1];
                if (param.startsWith("start=")) currentPos = Number(param.split("=")[1]);
                if (param.startsWith("step=")) currentStep = Number(param.split("=")[1]);
                if (param.startsWith("span=")) currentSpan = Number(param.split("=")[1]);
            }
            continue;
        }

        // Handle data lines
        const parts = line.trim().split(/\s+/);
        if (parts.length === 0) continue;

        let pos, value;
        if (currentStep === "variableStep") {
            if (parts.length >= 2) {
                pos = Number(parts[0]);
                value = Number(parts[1]);
            } else continue;
        } else if (currentStep === "fixedStep") {
            value = Number(parts[0]);
            pos = currentPos;
            currentPos += currentStep;
        } else continue;

        const feature = {
            line: ++cache.line,
            seqid: currentChrom,
            source: "WIG",
            type: "signal",
            start: pos,
            end: pos + currentSpan - 1,
            score: value,
            strand: null,
            phase: null,
            attributes: { value }
        };

        const type = "signal";
        if (!(type in json.types)) json.types[type] = new Set();
        json.types[type].add(null);

        cache.minmax[feature.type] ??= {};
        const minmax = cache.minmax[feature.type][null] ??= { min: feature.start, max: feature.end };
        if (feature.start < minmax.min) minmax.min = feature.start;
        if (feature.end > minmax.max) minmax.max = feature.end;

        json.features.push([feature]);
    }

    return { json, cache };
}

function ParseSAM(lines, json, cache) {
    for (const line of lines) {
        if (line.startsWith("@")) {
            // Handle SAM header lines as directives
            const [tag, ...params] = line.slice(1).split("\t");
            if (json.directives[tag]) json.directives[tag].push(params.join("\t"));
            else json.directives[tag] = [params.join("\t")];
            continue;
        }

        if (line.trim() === "") continue;

        const cols = line.split("\t");
        if (cols.length < 11) continue; // SAM requires at least 11 columns

        const [qname, flag, rname, pos, mapq, cigar, rnext, pnext, tlen, seq, qual, ...optional] = cols;

        const feature = {
            line: ++cache.line,
            seqid: rname,
            source: "SAM",
            type: "alignment",
            start: Number(pos),
            end: Number(pos) + seq.length - 1, // Approximate end based on sequence length
            score: Number(mapq),
            strand: (Number(flag) & 16) ? "-" : "+", // Check reverse complement flag
            phase: null,
            attributes: {
                qname,
                flag: Number(flag),
                cigar,
                rnext,
                pnext: Number(pnext),
                tlen: Number(tlen),
                seq,
                qual
            }
        };

        // Add optional fields
        for (const opt of optional) {
            const [tag, type, value] = opt.split(":");
            if (tag && type && value) {
                feature.attributes[tag] = type === "i" ? Number(value) : value;
            }
        }

        const type = "alignment";
        if (!(type in json.types)) json.types[type] = new Set();
        json.types[type].add(feature.strand);

        cache.minmax[feature.type] ??= {};
        const minmax = cache.minmax[feature.type][feature.strand] ??= { min: feature.start, max: feature.end };
        if (feature.start < minmax.min) minmax.min = feature.start;
        if (feature.end > minmax.max) minmax.max = feature.end;

        json.features.push([feature]);
    }

    return { json, cache };
}

function ParseVCF(lines, json, cache) {
    for (const line of lines) {
        if (line.startsWith("##")) {
            // Handle VCF meta-information lines
            const [k, ...v] = line.slice(2).split("=");
            if (json.directives[k]) json.directives[k].push(v.join("="));
            else json.directives[k] = [v.join("=")];
            continue;
        } else if (line.startsWith("#CHROM")) {
            // Handle header line
            json.directives.header = [line.slice(1)];
            continue;
        } else if (line.startsWith("#")) {
            continue;
        }

        if (line.trim() === "") continue;

        const cols = line.split("\t");
        if (cols.length < 8) continue; // VCF requires at least 8 columns

        const [chrom, pos, id, ref, alt, qual, filter, info, ...samples] = cols;

        const feature = {
            line: ++cache.line,
            seqid: chrom,
            source: "VCF",
            type: "variant",
            start: Number(pos),
            end: Number(pos) + ref.length - 1,
            score: qual === "." ? null : Number(qual),
            strand: null,
            phase: null,
            attributes: {
                ID: id !== "." ? id : null,
                REF: ref,
                ALT: alt,
                QUAL: qual !== "." ? Number(qual) : null,
                FILTER: filter
            }
        };

        // Parse INFO field
        if (info !== ".") {
            const infoPairs = info.split(";");
            for (const pair of infoPairs) {
                const [k, v] = pair.split("=");
                feature.attributes[k] = v || true; // Flag fields have no value
            }
        }

        // Add sample data if present
        if (samples.length > 0) {
            feature.attributes.samples = samples;
        }

        const type = "variant";
        if (!(type in json.types)) json.types[type] = new Set();
        json.types[type].add(null);

        cache.minmax[feature.type] ??= {};
        const minmax = cache.minmax[feature.type][null] ??= { min: feature.start, max: feature.end };
        if (feature.start < minmax.min) minmax.min = feature.start;
        if (feature.end > minmax.max) minmax.max = feature.end;

        json.features.push([feature]);
    }

    return { json, cache };
}

function ParseFASTA(lines, json, cache) {
    let currentSequence = null;
    let sequenceData = "";

    for (const line of lines) {
        if (line.startsWith(">")) {
            // Save previous sequence if exists
            if (currentSequence) {
                currentSequence.attributes.sequence = sequenceData;
                currentSequence.end = currentSequence.start + sequenceData.length - 1;

                // Update minmax
                cache.minmax[currentSequence.type] ??= {};
                const minmax = cache.minmax[currentSequence.type][null] ??= { min: currentSequence.start, max: currentSequence.end };
                if (currentSequence.start < minmax.min) minmax.min = currentSequence.start;
                if (currentSequence.end > minmax.max) minmax.max = currentSequence.end;

                json.features.push([currentSequence]);
            }

            // Start new sequence
            const header = line.slice(1).trim();
            const [id, ...description] = header.split(/\s+/);

            currentSequence = {
                line: ++cache.line,
                seqid: id,
                source: "FASTA",
                type: "sequence",
                start: 1,
                end: 1, // Will be updated when sequence is complete
                score: null,
                strand: null,
                phase: null,
                attributes: {
                    ID: id,
                    description: description.join(" ") || null
                }
            };

            sequenceData = "";

            const type = "sequence";
            if (!(type in json.types)) json.types[type] = new Set();
            json.types[type].add(null);
        } else if (currentSequence && line.trim()) {
            // Accumulate sequence data
            sequenceData += line.trim().replace(/\s/g, "");
        }
    }

    // Save final sequence
    if (currentSequence) {
        currentSequence.attributes.sequence = sequenceData;
        currentSequence.end = currentSequence.start + sequenceData.length - 1;

        cache.minmax[currentSequence.type] ??= {};
        const minmax = cache.minmax[currentSequence.type][null] ??= { min: currentSequence.start, max: currentSequence.end };
        if (currentSequence.start < minmax.min) minmax.min = currentSequence.start;
        if (currentSequence.end > minmax.max) minmax.max = currentSequence.end;

        json.features.push([currentSequence]);
    }

    return { json, cache };
}

function ParseFASTQ(lines, json, cache) {
    let state = 0; // 0: expecting header, 1: expecting sequence, 2: expecting +, 3: expecting quality
    let currentRead = null;

    for (const line of lines) {
        const trimmedLine = line.trim();

        if (state === 0 && trimmedLine.startsWith("@")) {
            // Header line
            const header = trimmedLine.slice(1);
            const [id, ...description] = header.split(/\s+/);

            currentRead = {
                line: ++cache.line,
                seqid: id,
                source: "FASTQ",
                type: "read",
                start: 1,
                end: 1, // Will be updated when sequence is known
                score: null,
                strand: null,
                phase: null,
                attributes: {
                    ID: id,
                    description: description.join(" ") || null
                }
            };

            const type = "read";
            if (!(type in json.types)) json.types[type] = new Set();
            json.types[type].add(null);

            state = 1;
        } else if (state === 1 && trimmedLine) {
            // Sequence line
            currentRead.attributes.sequence = trimmedLine;
            currentRead.end = currentRead.start + trimmedLine.length - 1;
            state = 2;
        } else if (state === 2 && trimmedLine.startsWith("+")) {
            // Plus line (optional description)
            state = 3;
        } else if (state === 3 && trimmedLine) {
            // Quality line
            currentRead.attributes.quality = trimmedLine;

            // Calculate average quality score
            let qualSum = 0;
            for (let i = 0; i < trimmedLine.length; i++) {
                qualSum += trimmedLine.charCodeAt(i) - 33; // Phred+33 encoding
            }
            currentRead.score = qualSum / trimmedLine.length;

            // Update minmax
            cache.minmax[currentRead.type] ??= {};
            const minmax = cache.minmax[currentRead.type][null] ??= { min: currentRead.start, max: currentRead.end };
            if (currentRead.start < minmax.min) minmax.min = currentRead.start;
            if (currentRead.end > minmax.max) minmax.max = currentRead.end;

            json.features.push([currentRead]);
            currentRead = null;
            state = 0;
        }
    }

    return { json, cache };
}

// Maintain backward compatibility
export function ParseGFF3Legacy(lines, json = {
    format: "GFF3",
    directives: {},
    features: [],
    types: {}
}, cache = { line: 0, ID: {}, minmax: {} }) {
    return ParseGenomicFile(lines, "", json, cache);
}

// Export the main parsing function
export { ParseGenomicFile, DetectFormat };