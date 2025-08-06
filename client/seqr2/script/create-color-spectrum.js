import { HslToRgb } from "./color.js";

export default function CreateColorSpectrum($paper) {
    if (!$paper || !($paper instanceof HTMLCanvasElement))
        throw new TypeError("Paper must be a valid HTMLCanvasElement");

    const [ H, S, L ] = [ 360, 100, 100 ];

    $paper.width = H;
    $paper.height = L;

    const pen = $paper.getContext("2d", { willReadFrequently: true });
    if (!pen) throw new Error("Failed to get 2d context");

    const imgData = pen.createImageData($paper.width, $paper.height);
    for (let x = 0; x < H; x++) {
        for (let y = 0; y < L; y++) {
            const [ r, g, b ] = HslToRgb(x, S, y);

            const i = (x + y * H) * 4;
            imgData.data[i] = r;
            imgData.data[i + 1] = g;
            imgData.data[i + 2] = b;
            imgData.data[i + 3] = 255; // fully opaque
        }
    }

    pen.putImageData(imgData, 0, 0);

    return pen;
}