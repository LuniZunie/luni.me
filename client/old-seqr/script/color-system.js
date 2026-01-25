export default class ColorSystem {
    // Enhanced color generation with better variety
    static generateDistinctColors(count) {
        const colors = [];
        const goldenAngle = 137.508; // Golden angle for optimal distribution

        for (let i = 0; i < count; i++) {
            // Use golden angle for hue distribution
            const hue = (i * goldenAngle) % 360;

            // Vary saturation and lightness for more variety
            const saturation = 60 + (i % 3) * 15; // 60%, 75%, 90%
            const lightness = 45 + (Math.floor(i / 3) % 3) * 10; // 45%, 55%, 65%

            colors.push(this.hslToHex(hue, saturation, lightness));
        }

        return colors;
    }

    // Biological feature color themes with more variety
    static getBioFeatureColor(type, index = 0) {
        const featureFamilies = {
            // Gene family - greens with variety
            gene: { baseHue: 120, variants: [
                { s: 70, l: 45 }, { s: 85, l: 55 }, { s: 60, l: 35 }
            ]},

            // Coding sequences - oranges
            CDS: { baseHue: 25, variants: [
                { s: 80, l: 50 }, { s: 90, l: 60 }, { s: 70, l: 40 }
            ]},

            // Exons - blues
            exon: { baseHue: 210, variants: [
                { s: 75, l: 50 }, { s: 85, l: 60 }, { s: 65, l: 40 }
            ]},

            // Introns - purples
            intron: { baseHue: 270, variants: [
                { s: 70, l: 50 }, { s: 80, l: 60 }, { s: 60, l: 40 }
            ]},

            // UTRs - yellows/golds
            UTR: { baseHue: 45, variants: [
                { s: 80, l: 55 }, { s: 90, l: 65 }, { s: 70, l: 45 }
            ]},

            // Promoters - reds
            promoter: { baseHue: 0, variants: [
                { s: 75, l: 50 }, { s: 85, l: 60 }, { s: 65, l: 40 }
            ]},

            // Enhancers - teals
            enhancer: { baseHue: 180, variants: [
                { s: 70, l: 50 }, { s: 80, l: 60 }, { s: 60, l: 40 }
            ]},

            // Repeats - grays with color hints
            repeat: { baseHue: 200, variants: [
                { s: 30, l: 50 }, { s: 40, l: 60 }, { s: 20, l: 40 }
            ]},

            // Transposons - dark purples
            transposon: { baseHue: 300, variants: [
                { s: 60, l: 35 }, { s: 70, l: 45 }, { s: 50, l: 25 }
            ]}
        };

        const family = featureFamilies[type];
        if (!family) // Generate dynamic color for unknown types
            return this.hslToHex((index * 137.5) % 360, 70, 50);

        const variant = family.variants[index % family.variants.length];
        return this.hslToHex(family.baseHue, variant.s, variant.l);
    }

    // Strand modification system with more dramatic differences
    static applyStrandModification(baseColor, strand, intensity = 1.0) {
        const modifications = {
            "+": {
                hueShift: -15 * intensity,      // Warmer
                saturationBoost: 20 * intensity, // More vibrant
                lightnessBoost: 10 * intensity   // Brighter
            },
            "-": {
                hueShift: 20 * intensity,        // Cooler
                saturationBoost: -10 * intensity, // Less vibrant
                lightnessBoost: -15 * intensity   // Darker
            },
            ".": {
                hueShift: 0,
                saturationBoost: -30 * intensity, // Much more muted
                lightnessBoost: -5 * intensity
            }
        };

        const mod = modifications[strand];
        if (!mod) {
            // For unknown strands, apply a unique hue shift
            const hash = strand.split("").reduce((a, b) => {
                a = ((a << 5) - a) + b.charCodeAt(0);
                return a & a;
            }, 0);
            return this.adjustColor(baseColor, {
                hue: (hash % 360),
                saturation: 10,
                lightness: 5
            });
        }

        return this.adjustColor(baseColor, {
            hue: mod.hueShift,
            saturation: mod.saturationBoost,
            lightness: mod.lightnessBoost
        });
    }

    // Convert HSL to Hex
    static hslToHex(h, s, l) {
        l /= 100;
        const a = s * Math.min(l, 1 - l) / 100;
        const f = n => {
            const k = (n + h / 30) % 12;
            const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * color).toString(16).padStart(2, "0");
        };
        return `#${f(0)}${f(8)}${f(4)}`;
    }

    // Adjust color by modifying HSL values
    static adjustColor(hexColor, adjustments = {}) {
        const { hue = 0, saturation = 0, lightness = 0 } = adjustments;

        // Convert hex to HSL
        const hsl = this.hexToHsl(hexColor);

        // Apply adjustments
        hsl.h = (hsl.h + hue + 360) % 360;
        hsl.s = Math.max(0, Math.min(100, hsl.s + saturation));
        hsl.l = Math.max(0, Math.min(100, hsl.l + lightness));

        // Convert back to hex
        return this.hslToHex(hsl.h, hsl.s, hsl.l);
    }

    // Convert hex to HSL
    static hexToHsl(hex) {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min)
            h = s = 0; // achromatic
        else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }

        return {
            h: h * 360,
            s: s * 100,
            l: l * 100
        };
    }

    // Blend multiple colors with weights
    static blendColors(colors, weights) {
        if (colors.length === 0) return "#95a5a6";
        if (colors.length === 1) return colors[0];

        // Convert hex to RGB
        const rgbColors = colors.map(color => {
            const hex = color.replace("#", "");
            return {
                r: parseInt(hex.substr(0, 2), 16),
                g: parseInt(hex.substr(2, 2), 16),
                b: parseInt(hex.substr(4, 2), 16)
            };
        });

        // Normalize weights
        const totalWeight = weights.reduce((sum, w) => sum + w, 0);
        const normWeights = weights.map(w => w / totalWeight);

        // Blend RGB values
        const blended = rgbColors.reduce((acc, color, i) => {
            const weight = normWeights[i];
            return {
                r: acc.r + color.r * weight,
                g: acc.g + color.g * weight,
                b: acc.b + color.b * weight
            };
        }, { r: 0, g: 0, b: 0 });

        // Convert back to hex
        const toHex = (n) => Math.round(n).toString(16).padStart(2, "0");
        return `#${toHex(blended.r)}${toHex(blended.g)}${toHex(blended.b)}`;
    }

    // Generate unique colors for members within a specific group
    static generateGroupColors(membersData) {
        // Create unique type+strand combinations within this group
        const uniqueCombos = new Set();
        for (const [name, type, strand] of membersData)
            uniqueCombos.add(`${type}${strand}`);

        const comboArray = Array.from(uniqueCombos);
        const groupColorMap = {};

        // Generate distinct colors for each unique combination in this group
        comboArray.forEach((combo, index) => {
            // Extract type and strand from combo
            const type = combo.slice(0, -1); // Everything except last character
            const strand = combo.slice(-1);  // Last character

            // Start with biologically meaningful base color
            const baseColor = this.getBioFeatureColor(type, index);

            // Apply strand modifications
            const finalColor = this.applyStrandModification(baseColor, strand);

            groupColorMap[combo] = finalColor;
        });

        return groupColorMap;
    }

    // Get unique values for each category to build color maps
    static getUniqueValues(globalFiles) {
        const unique = { files: new Set(), types: new Set(), strands: new Set() };

        for (const [name, file] of Object.entries(globalFiles || {})) {
            unique.files.add(name);
            for (const [type, vs] of Object.entries(file.types || {})) {
                unique.types.add(type);
                for (const v of vs)
                    unique.strands.add(v);
            }
        }

        return {
            files: Array.from(unique.files).sort(),
            types: Array.from(unique.types).sort(),
            strands: Array.from(unique.strands).sort()
        };
    }

    // Build color maps for consistent assignment
    static buildColorMaps(globalFiles) {
        const unique = this.getUniqueValues(globalFiles);

        // Generate distinct file colors
        const fileColors = this.generateDistinctColors(unique.files.length);
        const fileMap = {};
        unique.files.forEach((file, i) => fileMap[file] = fileColors[i]);

        // Create base type colors for biological meaning
        const typeMap = {};
        unique.types.forEach((type, i) => typeMap[type] = this.getBioFeatureColor(type, 0));

        // Create base strand colors
        const strandBaseColors = {
            "+": "#e74c3c",  // Red
            "-": "#3498db",  // Blue
            ".": "#95a5a6"   // Gray
        };

        const strandMap = {};
        unique.strands.forEach((strand, i) => {
            strandMap[strand] = strandBaseColors[strand] ||
                this.hslToHex((i * 60) % 360, 60, 50);
        });

        return { fileMap, typeMap, strandMap };
    }

    // Calculate member color for a specific group context
    static getMemberColorForGroup(name, type, strand, groupColorMap, fileMap, useFileGrouping = false) {
        const comboKey = `${type}${strand}`;
        let primaryColor = groupColorMap[comboKey];

        // Fallback if combination doesn't exist in group map
        if (!primaryColor) {
            const baseColor = this.getBioFeatureColor(type, 0);
            primaryColor = this.applyStrandModification(baseColor, strand);
        }

        // For file-based grouping, add subtle file influence
        if (useFileGrouping && fileMap[name]) // Blend with 85% type+strand, 15% file influence
            return this.blendColors([ primaryColor, fileMap[name] ], [ 0.85, 0.15 ]);

        return primaryColor;
    }

    // Convert RGB string (from BED itemRgb) to hex color
    static rgbStringToHex(rgbString) {
        if (!rgbString || rgbString === "0" || rgbString === "." || rgbString === "") return null;

        const parts = rgbString.split(",").map(s => parseInt(s.trim()));
        if (parts.length !== 3 || parts.some(p => isNaN(p) || p < 0 || p > 255)) return null;

        const [r, g, b] = parts;
        const toHex = (n) => n.toString(16).padStart(2, "0");
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    // Create a special marker color for file-defined colors
    static getFileDefinedColorMarker() {
        return "FILE_DEFINED";
    }

    // Check if a color is the file-defined marker
    static isFileDefinedColor(color) {
        return color === "FILE_DEFINED";
    }
}
