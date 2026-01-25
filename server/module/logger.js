import fs from "fs";
export default class Logger {
    static log(type, message, sources) {
        const [ date, time ] = new Date().toISOString().split("T");
        const path = `server/logs/${date}.log`;

        const field = (len, msg) => (msg.slice(0, len) || "-").padEnd(len, " ");

        const logMessage = `${date} ${time.slice(0, 8)} ${field(8, type)} ${message}\n${sources.map(str => `\t${str}`).join("\n")}\n\n`;
        console.log(logMessage.trim());
        try {
            fs.appendFileSync(path, logMessage, "utf8");
        } catch (err) {
            console.error(`Failed to write log: ${err.message}`);
        }
    }
}