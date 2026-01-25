import Logger from "./logger.js";
import path from "path";
import fs from "fs";

export default async function recursive_write(file, data, encoding = "utf8", sources) {
    sources = [ "recursive_write", ...(sources || []) ];

    const dir = path.dirname(file);
    try {
        await fs.promises.mkdir(dir, { recursive: true });
        await fs.promises.writeFile(file, data, encoding);
    } catch (err) {
        Logger.log("ERROR", `Failed to write file ${file}: ${err.message}`, sources);
        throw new Error("Internal server error");
    }
}