export function ParseGFF3(lines, json, cache) {
    if (!Array.isArray(lines)) {
        throw new TypeError("ParseGFF3(lines: string[], json: object, cache: object): <lines> not \"string[]\"");
    }

    const nullify = (v, fn = v => v) => v === "." ? null : fn(v);
    for (const line of lines) {
        if (typeof line !== "string") {
            throw new TypeError("ParseGFF3(line: string, json: object, cache: object): <line> not \"string\"");
        }

        cache.rawLine++;
        if (line.startsWith("##")) {
            const [ k, ...v ] = line.slice(2).split(/\s+/);
            if (json.directives[k]) {
                json.directives[k].push(v.join(" "));
            } else {
                json.directives[k] = [ v.join(" ") ];
            }

            continue;
        } else if (line.startsWith("#") || line.trim() === "") {
            continue;
        }

        const columns = line.split("\t");
        if (columns.length !== 9) {
            throw new Error(`Invalid number of columns (line ${cache.rawLine})`);
        }

        const [ seqid, source, type, start, end, score, strand, phase, attributes ] = columns;
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
            attributes: { }
        };

        (json.types[type] ??= { })[strand] = true;
        if (nullify(attributes)) {
            const pairs = attributes.split(";");
            for (const pair of pairs) {
                const [ k, v ] = pair.split("=");
                if (k && v) {
                    feature.attributes[k] = decodeURIComponent(v);
                }
            }
        }

        const minmax = (json.minmax[feature.type] ??= { })[strand] ??= {
            min: feature.start,
            max: feature.end
        };
        if (feature.start < minmax.min) {
            minmax.min = feature.start;
        }
        if (feature.end > minmax.max) {
            minmax.max = feature.end;
        }

        const ID = feature.attributes.ID;
        if (ID) {
            if (cache.ID[ID]) {
                cache.ID[ID].push(feature);
            } else {
                const array = [ feature ];
                json.features.push(array);
                cache.ID[ID] = array;
            }
        } else {
            json.features.push([ feature ]);
        }
    }

    return { json, cache };
};