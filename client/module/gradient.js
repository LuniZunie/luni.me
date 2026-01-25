import "./HTML.js";

export default class Gradient {
    #data;
    constructor(res, ...colors) {
        if (!Number.isInteger(res) || res < 1)
            throw new Error("Gradient: Resolution must be a positive integer.");

        const paper = document.create("canvas", { width: res, height: 1 });
        const pen = paper.getContext("2d");

        const gradient = pen.createLinearGradient(0, 0, res, 0);
        const len = colors.length, step = 1 / (len - 1);
        for (let i = 0; i < len; i++) {
            const color = colors[i];
            if (typeof color !== "string") throw new Error(`Gradient: Color at index ${i} is not a valid string.`);
            gradient.addColorStop(i * step, color);
        }
        pen.fillStyle = gradient;
        pen.fillRect(0, 0, res, 1);

        const data = pen.getImageData(0, 0, res, 1).data, temp = [];
        for (let i = 0; i < data.length; i += 4) {
            let [ r, g, b, a ] = data.slice(i, i + 4);
            a /= 255; // normalize alpha to [0, 1]
            temp.push({ r, g, b, a, color: `rgba(${r}, ${g}, ${b}, ${a})` });
        }
        this.#data = temp;
    }

    get(n) {
        if (typeof n !== "number" || n < 0 || n > 1) throw new Error("Gradient: Value must be a number between 0 and 1.");
        const index = Math.floor(n * (this.#data.length - 1));
        return this.#data[index];
    }
}