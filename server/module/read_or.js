import fs from "fs";
import Logger from "./logger.js";
import recursive_write from "./recursive_write.js";

export default async function read_or(file, encoding, fallback, sources) {
    sources = [ "read_or", ...(sources || []) ];

    let resolve, reject;
    const promise = new Promise((res, rej) => ([ resolve, reject ] = [ res, rej ]));
    try {
        await fs.promises.access(file, fs.constants.R_OK);
        fs.promises.readFile(file, encoding)
            .then(data => resolve({ status: 200, data }))
            .catch(err => {
                Logger.log("ERROR", `Failed to read file ${file}: ${err.message}`, sources);
                reject({ status: 500, error: "Internal server error" });
            });
    } catch (err) {
        if (err.code === "ENOENT") {
            if (fallback !== null && fallback !== undefined) {
                recursive_write(file, fallback, encoding, sources)
                    .then(() => resolve({ status: 200, data: fallback }))
                    .catch(err => {
                        Logger.log("ERROR", `Failed to write fallback file ${file}: ${err.message}`, sources);
                        reject({ status: 500, error: "Internal server error" });
                    });
            } else {
                Logger.log("WARN", `File not found: ${file}`, sources);
                reject({ status: 404, error: "File not found" });
            }
        } else {
            Logger.log("ERROR", `Failed to access file ${file}: ${err.message}`, sources);
            reject({ status: 500, error: "Internal server error" });
        }
    }
    return promise;
}