import { ParseGFF3 } from "./parse/gff3.js";

export function ParseFile(name, lines, json = null, cache = null, first = false) {
    json ??= {
        format: null,
        directives: { },
        types: { },

        minmax: { },
        colors: { },

        features: [ ]
    };
    cache ??= {
        rawLine: 0,
        line: 0,
        ID: { }
    };

    if (first) {
        json.format = DetectFormat(name, lines);
    }

    switch (json.format) {
        case "GFF3": return ParseGFF3(lines, json, cache);
        default: throw Error("[__TEMP__] not yet supported")
    }
};

const VERSION = /##gff-version\s+([\d.]+)/;
function DetectFormat(name, lines) {
    switch (name.split(".").pop().toLowerCase()) {
        case "bdg":
        case "bedgraph": return "BEDGRAPH";

        case "bed": return "bed";

        case "fa":
        case "fas":
        case "fasta": return "FASTA";

        case "fq":
        case "fastq": return "FASTQ";

        case "gff":
        case "gff2":
        case "gff3": {
            const version = lines[0].match(VERSION)?.[1] ?? "3";
            switch (version.split(".").shift()) {
                default:
                case "3": return "GFF3";
                case "2": return "GFF2";
            }
        }

        case "gtf": return "GTF";

        case "sam": return "SAM";

        case "vcf": return "VCF";

        case "wig":
        case "wiggle": return "WIG";

        default: return "GFF3";
    }
}