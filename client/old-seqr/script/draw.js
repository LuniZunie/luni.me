import "../../prototype/HTML.js";
import { global } from "./global.js";
import ColorSystem from "./color-system.js";

export default async function Draw(settings, wr = 1, hr = 1) {
    // Use aspect ratio from settings if provided, otherwise use the passed parameters
    if (settings.aspectRatio) {
        wr = settings.aspectRatio.width;
        hr = settings.aspectRatio.height;
    }

    if (wr === hr) wr = hr = 1;
    else if (wr < hr) wr /= hr, hr = 1;
    else if (hr < wr) hr /= wr, wr = 1;

    const { min, max } = settings.viewRange;
    const width = max - min;

    // Calculate intended export dimensions for text scaling
    const DEFAULT_EXPORT_WIDTH = 1200; // Minimum export width used in export logic
    const EXPORT_SCALE = 4; // Scale factor used during export
    const exportWidth = DEFAULT_EXPORT_WIDTH;
    const exportHeight = DEFAULT_EXPORT_WIDTH * (hr / wr);

    const groups = [];
    const ref = {};
    for (const group of Object.values(global.groups ?? {})) {
        const groupRef = [];

        for (const member of group.members) {
            let root = ref;
            for (const part of member.member)
                root = root[part] ??= {};
            root.groups ??= [], root.groups.push({ ref: groupRef, color: member.color, settings: member.settings });
        }

        groups.push({ name: group.name, ref: groupRef });
    }

    let height = 0;
    const labelHeight = settings.textStyle ? 1 : 0; // Reserve space for labels if textStyle is provided
    const groupSeparatorHeight = 0.2; // Small gap between groups

    // Load all file data first
    const fileLoadPromises = [];
    for (const file of Object.values(global.files ?? {})) {
        const rootRef = ref[file.unique];
        if (!rootRef) continue;

        if (!file.isDataLoaded())
            fileLoadPromises.push(file.loadFileData());
    }

    // Wait for all file data to be loaded
    if (fileLoadPromises.length > 0) await Promise.all(fileLoadPromises);

    for (const file of Object.values(global.files ?? {})) {
        const rootRef = ref[file.unique];
        if (!rootRef) continue;

        // Handle chunked features
        if (file.features && typeof file.features[Symbol.asyncIterator] === "function") // Chunked features - iterate asynchronously
            for await (const feature of file.features)
                await ProcessFeature(feature, rootRef);
        else for (const feature of file.features || []) // Traditional features array
            await ProcessFeature(feature, rootRef);
    }

    async function ProcessFeature(feature, rootRef) {
        const push = new Map();
        let [ start, end ] = [ Infinity, -Infinity ];

        for (const part of feature) {
            const groups = rootRef[part.type]?.[part.strand];
            if (!groups) continue;

            if (part.start < start) start = part.start;
            if (part.end > end) end = part.end;

            for (const group of groups.groups) {
                if (!push.has(group)) push.set(group, []);

                // Determine the color to use
                let color = group.color;
                if (group.settings?.asDefinedInFile) {
                    if (part.attributes && part.attributes.itemRgb) {
                        if (part.source === "BED") {
                            color = `rgb(${part.attributes.itemRgb})`;
                        }
                    }
                }

                push.get(group).push({
                    start: part.start,
                    end: part.end,
                    color: color,
                    attributes: part.attributes,
                    source: part.source
                });
            }
        }

        if (start < min && end < min) return;
        if (start > max && end > max) return;

        for (const [ group, parts ] of push) {
            group.ref.push(parts);
            height++;
        }
    }

    // Calculate total height including labels and separators
    const totalGroups = groups.length;
    const totalHeight = height + (totalGroups * labelHeight) + ((totalGroups - 1) * groupSeparatorHeight);

    const $svg = document.qs("#content > svg");
    if (!$svg) return;

    const widthRatio = wr * 1000;
    const heightRatio = hr * 1000;

    // Reserve space for scales if enabled
    const scaleHeight = settings.scale?.enabled ? (DEFAULT_EXPORT_WIDTH / widthRatio * 20) : 0;
    const topScaleSpace = (settings.scale?.enabled && (settings.scale.position === "top" || settings.scale.position === "both")) ? scaleHeight : 0;
    const bottomScaleSpace = (settings.scale?.enabled && (settings.scale.position === "bottom" || settings.scale.position === "both")) ? scaleHeight : 0;

    // Adjust available drawing area to avoid overlap with scales
    const availableHeight = heightRatio - topScaleSpace - bottomScaleSpace;
    const drawingStartY = topScaleSpace;

    $svg.innerHTML = ""; // clear previous content
    $svg.setAttribute("viewBox", `0 0 ${widthRatio} ${heightRatio}`);
    $svg.style.background = settings.background;

    // Performance thresholds for infinite scalability
    const MAX_ELEMENTS_PER_CHUNK = 500; // Maximum elements before converting to image
    const MAX_IMAGES_PER_LAYER = 50; // Maximum images before consolidating into a single image
    const CANVAS_SCALE = 2; // Higher resolution for better quality

    // Helper function to create styled text
    function CreateStyledText(text, x, y, textStyle) {
        const $text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        $text.textContent = text;
        $text.setAttribute("x", x);
        $text.setAttribute("y", y);

        // Calculate font size based on intended export dimensions for consistent scaling
        // Base calculation: (user size / 100) * (export width / SVG width) * size factor
        const viewportToExportRatio = exportWidth / widthRatio;
        const baseFontSize = (textStyle.size / 100) * viewportToExportRatio * 18; // 18px base size

        // Adaptive scaling factors for better readability
        const densityScale = Math.max(0.6, Math.min(2.0, Math.sqrt(8 / Math.max(1, totalHeight))));
        const sizeScale = Math.max(0.8, Math.min(1.5, exportWidth / 1200)); // Scale with export size

        // Ensure minimum readable size while respecting the scaling
        const rawFontSize = baseFontSize * densityScale * sizeScale;
        const minSizeInSVGUnits = (exportWidth / widthRatio) * 8; // Minimum 8px in final export
        const fontSize = Math.max(rawFontSize, minSizeInSVGUnits);

        $text.setAttribute("font-size", fontSize);
        $text.setAttribute("font-family", textStyle.font);
        $text.setAttribute("fill", textStyle.color);
        $text.setAttribute("text-anchor", textStyle.align === "left" ? "start" : textStyle.align === "right" ? "end" : "middle");

        // Apply text styles
        if (textStyle.style.bold) $text.setAttribute("font-weight", "bold");
        if (textStyle.style.italic) $text.setAttribute("font-style", "italic");

        // Handle text decorations (can be combined)
        const decorations = [];
        if (textStyle.style.underline) decorations.push("underline");
        if (textStyle.style.strikethrough) decorations.push("line-through");
        if (textStyle.style.overline) decorations.push("overline");
        if (decorations.length > 0) $text.setAttribute("text-decoration", decorations.join(" "));

        // Handle outline (box around text)
        if (textStyle.style.outline) {
            // Create a group to hold both the outline rectangle and the text
            const $group = document.createElementNS("http://www.w3.org/2000/svg", "g");

            // Estimate text dimensions with improved calculation
            const textWidth = text.length * fontSize * 0.6; // Rough estimation
            const textHeight = fontSize;
            const padding = fontSize * 0.15; // Slightly larger padding for better visibility

            // Calculate rectangle position based on text anchor
            let rectX, rectY;
            if (textStyle.align === "left") {
                rectX = x - padding;
            } else if (textStyle.align === "right") {
                rectX = x - textWidth - padding;
            } else { // center
                rectX = x - textWidth / 2 - padding;
            }
            rectY = y - textHeight * 0.8 - padding; // Adjust for text baseline

            // Create outline rectangle
            const $outline = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            $outline.setAttribute("x", rectX);
            $outline.setAttribute("y", rectY);
            $outline.setAttribute("width", textWidth + padding * 2);
            $outline.setAttribute("height", textHeight + padding * 2);
            $outline.setAttribute("fill", "none");
            $outline.setAttribute("stroke", textStyle.color);
            $outline.setAttribute("stroke-width", fontSize * 0.05); // Scale outline with text size

            $group.appendChild($outline);
            $group.appendChild($text);

            return $group;
        }

        return $text;
    }

    // Helper function to render features to canvas and convert to image
    async function RenderToCanvas(features, startY, endY, canvasWidth, canvasHeight) {
        const $paper = document.createElement("canvas");
        $paper.width = canvasWidth * CANVAS_SCALE;
        $paper.height = canvasHeight * CANVAS_SCALE;
        const pen = $paper.getContext("2d");

        // Scale for high resolution
        pen.scale(CANVAS_SCALE, CANVAS_SCALE);

        // Clear with transparent background
        pen.clearRect(0, 0, canvasWidth, canvasHeight);

        // Render features
        for (const feature of features) {
            const { colorGroups, y, h } = feature;
            const relativeY = y - startY;

            // Draw rectangles
            for (const [ color, elements ] of colorGroups) {
                pen.fillStyle = color;
                for (const rect of elements.rects)
                    pen.fillRect(rect.x, relativeY + rect.y - y, rect.w, rect.h);

                // Draw lines
                if (elements.lines.length > 0) {
                    pen.strokeStyle = color;
                    pen.lineWidth = 1;
                    pen.beginPath();
                    for (const line of elements.lines) {
                        pen.moveTo(line.x1, relativeY + line.y1 - y);
                        pen.lineTo(line.x2, relativeY + line.y2 - y);
                    }
                    pen.stroke();
                }
            }
        }

        // Convert to data URL
        return new Promise(resolve => {
            $paper.toBlob(blob => {
                const url = URL.createObjectURL(blob);
                resolve(url);
            }, "image/png");
        });
    }

    // Helper function to consolidate multiple images into a single image
    async function ConsolidateImages(imageElements, totalWidth, totalHeight) {
        const $paper = document.createElement("canvas");
        $paper.width = totalWidth * CANVAS_SCALE;
        $paper.height = totalHeight * CANVAS_SCALE;
        const pen = $paper.getContext("2d");

        // Scale for high resolution
        pen.scale(CANVAS_SCALE, CANVAS_SCALE);

        // Clear with transparent background
        pen.clearRect(0, 0, totalWidth, totalHeight);

        // Load and draw each image
        const imagePromises = imageElements.map(async (imageEl) => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    const x = parseFloat(imageEl.getAttribute("x"));
                    const y = parseFloat(imageEl.getAttribute("y"));
                    const width = parseFloat(imageEl.getAttribute("width"));
                    const height = parseFloat(imageEl.getAttribute("height"));

                    pen.drawImage(img, x, y, width, height);
                    resolve();
                };
                img.onerror = reject;
                img.src = imageEl.getAttribute("href");
            });
        });

        await Promise.all(imagePromises);

        // Convert to blob URL
        return new Promise(resolve => {
            $paper.toBlob(blob => {
                const url = URL.createObjectURL(blob);
                resolve(url);
            }, "image/png");
        });
    }

    /**
     * Creates BED-specific drawing elements supporting BED format features:
     * - blockCount, blockSizes, blockStarts: Draws individual blocks (exons) with connecting lines
     * - thickStart, thickEnd: Draws thick regions (coding sequences) taller than thin regions (UTRs)
     *
     * Visual representation:
     * - Blocks: Individual rectangles for each exon
     * - Thick regions: 40% taller rectangles (coding sequences)
     * - Thin regions: 50% height rectangles (UTRs, introns)
     * - Connecting lines: Lines between blocks when gaps exist
     *
     * @param {Object} part - Feature part with attributes
     * @param {number} baseX - Base X coordinate
     * @param {number} baseY - Base Y coordinate
     * @param {number} baseW - Base width
     * @param {number} baseH - Base height
     * @param {number} widthRatio - Width scaling ratio
     * @param {number} width - Total view width
     * @param {number} min - Minimum view position
     * @returns {Object} Elements object with rects and lines arrays
     */
    function CreateBEDElements(part, baseX, baseY, baseW, baseH, widthRatio, width, min) {
        const elements = { rects: [], lines: [] };

        if (!part.attributes || part.source !== "BED") {
            // Standard rectangle for non-BED features
            elements.rects.push({ x: baseX, y: baseY, w: baseW, h: baseH });
            return elements;
        }

        const attrs = part.attributes;

        // Handle blocks if present
        if (attrs.blockCount && attrs.blockSizes && attrs.blockStarts) {
            const blockCount = attrs.blockCount;
            const blockSizes = attrs.blockSizes.split(",").map(Number);
            const blockStarts = attrs.blockStarts.split(",").map(Number);

            // Validate arrays have correct length
            const actualBlockCount = Math.min(blockCount, blockSizes.length, blockStarts.length);

            // Draw each block
            for (let i = 0; i < actualBlockCount; i++) {
                const blockStart = part.start + blockStarts[i];
                const blockEnd = blockStart + blockSizes[i];

                // Skip blocks outside the view range
                if (blockEnd <= min || blockStart >= min + width) continue;

                // Clamp block to view range
                const clampedStart = Math.max(blockStart, min);
                const clampedEnd = Math.min(blockEnd, min + width);

                const blockX = (clampedStart - min) / width * widthRatio;
                const blockW = (clampedEnd - clampedStart) / width * widthRatio;

                // Determine block height based on thick regions
                let blockY = baseY;
                let blockH = baseH;

                // Check if this block overlaps with thick region
                if (attrs.thickStart && attrs.thickEnd && attrs.thickStart < attrs.thickEnd) {
                    const thickStart = attrs.thickStart;
                    const thickEnd = attrs.thickEnd;

                    if (blockStart < thickEnd && blockEnd > thickStart) {
                        // Block overlaps with thick region - use normal size
                        blockY = baseY;
                        blockH = baseH;
                    } else {
                        // Block is in thin region - make it smaller
                        blockY = baseY + baseH * 0.25; // Move down
                        blockH = baseH * 0.5; // Make 50% of normal height
                    }
                } else {
                    // No thick region defined - use normal size
                    blockY = baseY;
                    blockH = baseH;
                }

                elements.rects.push({ x: blockX, y: blockY, w: blockW, h: blockH });
            }

            // Add connecting lines between blocks
            for (let i = 0; i < actualBlockCount - 1; i++) {
                const currentBlockEnd = part.start + blockStarts[i] + blockSizes[i];
                const nextBlockStart = part.start + blockStarts[i + 1];

                // Only draw connecting line if there's a gap and both ends are in view
                if (nextBlockStart > currentBlockEnd &&
                    currentBlockEnd >= min && nextBlockStart <= min + width) {
                    const lineX1 = (currentBlockEnd - min) / width * widthRatio;
                    const lineX2 = (nextBlockStart - min) / width * widthRatio;
                    const lineY = baseY + baseH / 2;

                    elements.lines.push({
                        x1: lineX1,
                        y1: lineY,
                        x2: lineX2,
                        y2: lineY
                    });
                }
            }
        } else if (attrs.thickStart && attrs.thickEnd && attrs.thickStart < attrs.thickEnd) {
            // No blocks, but has thick regions - draw thin/thick segments
            const thickStart = attrs.thickStart;
            const thickEnd = attrs.thickEnd;

            // Draw thin start region (if present and visible)
            if (part.start < thickStart && part.start < min + width) {
                const thinEndPos = Math.min(thickStart, part.end);
                const clampedStart = Math.max(part.start, min);
                const clampedEnd = Math.min(thinEndPos, min + width);

                if (clampedStart < clampedEnd) {
                    const thinX = (clampedStart - min) / width * widthRatio;
                    const thinW = (clampedEnd - clampedStart) / width * widthRatio;
                    const thinY = baseY + baseH * 0.25;
                    const thinH = baseH * 0.5;

                    elements.rects.push({ x: thinX, y: thinY, w: thinW, h: thinH });
                }
            }

            // Draw thick middle region (if visible)
            if (thickStart < part.end && thickEnd > part.start &&
                thickStart < min + width && thickEnd > min) {
                const thickDrawStart = Math.max(thickStart, part.start, min);
                const thickDrawEnd = Math.min(thickEnd, part.end, min + width);

                if (thickDrawStart < thickDrawEnd) {
                    const thickX = (thickDrawStart - min) / width * widthRatio;
                    const thickW = (thickDrawEnd - thickDrawStart) / width * widthRatio;
                    const thickY = baseY; // Use normal position
                    const thickH = baseH; // Use normal height

                    elements.rects.push({ x: thickX, y: thickY, w: thickW, h: thickH });
                }
            }

            // Draw thin end region (if present and visible)
            if (part.end > thickEnd && thickEnd < min + width) {
                const thinStartPos = Math.max(thickEnd, part.start);
                const clampedStart = Math.max(thinStartPos, min);
                const clampedEnd = Math.min(part.end, min + width);

                if (clampedStart < clampedEnd) {
                    const thinX = (clampedStart - min) / width * widthRatio;
                    const thinW = (clampedEnd - clampedStart) / width * widthRatio;
                    const thinY = baseY + baseH * 0.25;
                    const thinH = baseH * 0.5;

                    elements.rects.push({ x: thinX, y: thinY, w: thinW, h: thinH });
                }
            }
        } else {
            // Standard rectangle for BED features without special attributes
            elements.rects.push({ x: baseX, y: baseY, w: baseW, h: baseH });
        }

        return elements;
    }

    // Collect all rendering data first
    const allFeatures = [];
    let currentY = 0;
    let groupIndex = 0;

    const groupsMax = groups.length - 1;
    for (const group of groups) {
        // Add group label if textStyle is provided
        if (settings.textStyle && labelHeight > 0) {
            const labelY = drawingStartY + (currentY + labelHeight * 0.7) / totalHeight * availableHeight; // Position text at 70% of label height
            const labelX = settings.textStyle.align === "left" ? 0 :
                          settings.textStyle.align === "right" ? widthRatio :
                          widthRatio / 2;

            const $label = CreateStyledText(group.name, labelX, labelY, settings.textStyle);
            $svg.appendChild($label);
            currentY += labelHeight;
        }

        // Create group container
        const $g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        $g.setAttribute("class", "group");
        $g.setAttribute("data-name", group.name);
        $svg.appendChild($g);

        // Collect feature rendering data
        for (const ref of group.ref) {
            // Group parts by color to create consolidated paths
            const colorGroups = new Map();
            let lastRight;
            const y = drawingStartY + (currentY + 0.1) / totalHeight * availableHeight;
            const h = 0.8 / totalHeight * availableHeight;

            // Collect all parts and lines by color
            for (const part of ref) {
                const x = (part.start - min) / width * widthRatio;
                const w = (part.end - part.start) / width * widthRatio;

                // Determine the actual color to use for rendering
                let renderColor = part.color;

                if (!colorGroups.has(renderColor))
                    colorGroups.set(renderColor, { rects: [], lines: [] });

                // Use BED-aware drawing function
                const bedElements = CreateBEDElements(part, x, y, w, h, widthRatio, width, min);
                const colorGroup = colorGroups.get(renderColor);

                // Add all rectangles and lines from BED processing
                colorGroup.rects.push(...bedElements.rects);
                colorGroup.lines.push(...bedElements.lines);

                // Add connecting line if there was a previous part (only for non-BED features or when blocks aren't used)
                if (lastRight !== undefined && (!part.attributes || !part.attributes.blockCount)) {
                    colorGroup.lines.push({
                        x1: lastRight,
                        y1: y + h / 2,
                        x2: x,
                        y2: y + h / 2
                    });
                }

                lastRight = x + w;
            }

            allFeatures.push({ colorGroups, y, h, group: $g });
            currentY++;
        }

        // Add separator line between groups (except after the last group)
        if (groupIndex < groupsMax) {
            const separatorY = drawingStartY + (currentY + groupSeparatorHeight / 2) / totalHeight * availableHeight;
            const $separator = document.createElementNS("http://www.w3.org/2000/svg", "line");
            $separator.setAttribute("x1", 0);
            $separator.setAttribute("y1", separatorY);
            $separator.setAttribute("x2", widthRatio);
            $separator.setAttribute("y2", separatorY);
            $separator.setAttribute("stroke", settings.textStyle?.color || "#808080");
            $separator.setAttribute("stroke-width", 1);
            $separator.setAttribute("opacity", "0.3");
            $svg.appendChild($separator);

            currentY += groupSeparatorHeight;
        }

        groupIndex++;
    }

    // Render features in chunks, converting to images when necessary
    if (allFeatures.length <= MAX_ELEMENTS_PER_CHUNK) {
        // Small dataset - render directly as SVG paths
        for (const feature of allFeatures) {
            const { colorGroups, group } = feature;

            for (const [ color, elements ] of colorGroups) {
                if (elements.rects.length > 0) {
                    let rectPath = "";
                    for (const rect of elements.rects)
                        rectPath += `M${rect.x},${rect.y} h${rect.w} v${rect.h} h${-rect.w} z `;

                    const $rectPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
                    $rectPath.setAttribute("d", rectPath);
                    $rectPath.setAttribute("fill", color);
                    group.appendChild($rectPath);
                }

                if (elements.lines.length > 0) {
                    let linePath = "";
                    for (const line of elements.lines)
                        linePath += `M${line.x1},${line.y1} L${line.x2},${line.y2} `;

                    const $linePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
                    $linePath.setAttribute("d", linePath);
                    $linePath.setAttribute("stroke", color);
                    $linePath.setAttribute("fill", "none");
                    $linePath.setAttribute("stroke-width", "1");
                    group.appendChild($linePath);
                }
            }
        }
    } else // Large dataset - render with recursive image consolidation
        await RenderWithImageConsolidation(allFeatures);

    // Recursive function to handle infinite scalability through image consolidation
    async function RenderWithImageConsolidation(features) {
        const chunkSize = MAX_ELEMENTS_PER_CHUNK;
        const chunks = [];

        for (let i = 0; i < features.length; i += chunkSize)
            chunks.push(features.slice(i, i + chunkSize));

        const imageElements = [];
        const oldBlobUrls = []; // Track URLs for cleanup

        // Create initial images from feature chunks
        const chunkLen = chunks.length;
        for (let chunkIndex = 0; chunkIndex < chunkLen; chunkIndex++) {
            const chunk = chunks[chunkIndex];
            const chunkMax = chunk.length - 1;

            const startY = chunk[0].y;
            const endY = chunk[chunkMax].y + chunk[chunkMax].h;
            const chunkHeight = endY - startY;

            try {
                const imageUrl = await RenderToCanvas(chunk, startY, endY, widthRatio, chunkHeight);
                oldBlobUrls.push(imageUrl);

                // Create image element
                const $image = document.createElementNS("http://www.w3.org/2000/svg", "image");
                $image.setAttribute("x", 0);
                $image.setAttribute("y", startY);
                $image.setAttribute("width", widthRatio);
                $image.setAttribute("height", chunkHeight);
                $image.setAttribute("href", imageUrl);

                imageElements.push($image);
            } catch (error) {
                console.warn(`Failed to render chunk ${chunkIndex} as image, falling back to SVG:`, error);

                // Fallback to SVG rendering for this chunk
                for (const feature of chunk) {
                    const { colorGroups, group } = feature;

                    for (const [ color, elements ] of colorGroups) {
                        if (elements.rects.length > 0) {
                            let rectPath = "";
                            for (const rect of elements.rects)
                                rectPath += `M${rect.x},${rect.y} h${rect.w} v${rect.h} h${-rect.w} z `;

                            const $rectPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
                            $rectPath.setAttribute("d", rectPath);
                            $rectPath.setAttribute("fill", color);
                            group.appendChild($rectPath);
                        }

                        if (elements.lines.length > 0) {
                            let linePath = "";
                            for (const line of elements.lines)
                                linePath += `M${line.x1},${line.y1} L${line.x2},${line.y2} `;

                            const $linePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
                            $linePath.setAttribute("d", linePath);
                            $linePath.setAttribute("stroke", color);
                            $linePath.setAttribute("fill", "none");
                            $linePath.setAttribute("stroke-width", "1");
                            group.appendChild($linePath);
                        }
                    }
                }
            }
        }

        // Recursive consolidation: if we have too many images, consolidate them
        while (imageElements.length > MAX_IMAGES_PER_LAYER) {
            const consolidatedImages = [];
            const imageBatches = [];

            // Group images into batches for consolidation
            for (let i = 0; i < imageElements.length; i += MAX_IMAGES_PER_LAYER)
                imageBatches.push(imageElements.slice(i, i + MAX_IMAGES_PER_LAYER));

            // Consolidate each batch
            for (const batch of imageBatches) {
                try {
                    // Calculate bounding box for this batch
                    let minY = Infinity, maxY = -Infinity;
                    for (const img of batch) {
                        const y = parseFloat(img.getAttribute("y"));
                        const height = parseFloat(img.getAttribute("height"));
                        minY = Math.min(minY, y);
                        maxY = Math.max(maxY, y + height);
                    }

                    const consolidatedHeight = maxY - minY;
                    const consolidatedUrl = await ConsolidateImages(batch, widthRatio, consolidatedHeight);
                    oldBlobUrls.push(consolidatedUrl);

                    // Create consolidated image element
                    const $consolidatedImage = document.createElementNS("http://www.w3.org/2000/svg", "image");
                    $consolidatedImage.setAttribute("x", 0);
                    $consolidatedImage.setAttribute("y", minY);
                    $consolidatedImage.setAttribute("width", widthRatio);
                    $consolidatedImage.setAttribute("height", consolidatedHeight);
                    $consolidatedImage.setAttribute("href", consolidatedUrl);

                    consolidatedImages.push($consolidatedImage);
                } catch (error) {
                    console.warn("Failed to consolidate image batch, keeping originals:", error);
                    consolidatedImages.push(...batch);
                }
            }

            // Replace imageElements with consolidated ones
            imageElements.length = 0;
            imageElements.push(...consolidatedImages);
        }

        // Add final images to SVG
        for (const $image of imageElements)
            $svg.appendChild($image);

        // Clean up old blob URLs after a delay
        setTimeout(() => {
            for (const url of oldBlobUrls)
                URL.revokeObjectURL(url);
        }, 2000);
    }

    // Add scale if enabled
    if (settings.scale?.enabled) {
        const scaleHeight = exportWidth / widthRatio * 20; // Scale height in SVG units
        const textColor = settings.textStyle?.color || "#FFFFFF";

        // Calculate text padding needed to prevent cutoff
        let textPadding = 0;
        if (settings.textStyle) {
            // Estimate the maximum text width for the first and last labels
            const minLabel = min >= 1000000 ? `${(min / 1000000).toFixed(1)}M` :
                           min >= 1000 ? `${(min / 1000).toFixed(1)}K` :
                           Math.round(min).toString();
            const maxLabel = max >= 1000000 ? `${(max / 1000000).toFixed(1)}M` :
                           max >= 1000 ? `${(max / 1000).toFixed(1)}K` :
                           Math.round(max).toString();

            const longestLabel = minLabel.length > maxLabel.length ? minLabel : maxLabel;

            // Calculate font size (same calculation as in CreateStyledText)
            const viewportToExportRatio = exportWidth / widthRatio;
            const baseFontSize = (Math.max(settings.textStyle.size * 0.8, 30) / 100) * viewportToExportRatio * 18;
            const densityScale = Math.max(0.6, Math.min(2.0, Math.sqrt(8 / Math.max(1, totalHeight))));
            const sizeScale = Math.max(0.8, Math.min(1.5, exportWidth / 1200));
            const fontSize = Math.max(baseFontSize * densityScale * sizeScale, (exportWidth / widthRatio) * 8);

            // Estimate text width (rough approximation: 0.6 * fontSize * character count)
            const estimatedTextWidth = longestLabel.length * fontSize * 0.6;
            textPadding = estimatedTextWidth / 2; // Half width for center alignment
        }

        function CreateScale(yPosition, isTop = true) {
            const $scaleGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
            $scaleGroup.setAttribute("class", `scale scale-${isTop ? "top" : "bottom"}`);

            // Calculate tick positions
            const majorTickCount = settings.scale.majorTicks;
            const minorTickCount = settings.scale.minorTicks;

            // Create background for scale (accounting for text padding)
            const $background = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            $background.setAttribute("x", -textPadding);
            $background.setAttribute("y", yPosition);
            $background.setAttribute("width", widthRatio + (textPadding * 2));
            $background.setAttribute("height", scaleHeight);
            $background.setAttribute("fill", settings.background === "none" ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)");
            $scaleGroup.appendChild($background);

            // Main scale line
            const scaleLineY = isTop ? yPosition + scaleHeight : yPosition;
            const $scaleLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
            $scaleLine.setAttribute("x1", 0);
            $scaleLine.setAttribute("y1", scaleLineY);
            $scaleLine.setAttribute("x2", widthRatio);
            $scaleLine.setAttribute("y2", scaleLineY);
            $scaleLine.setAttribute("stroke", textColor);
            $scaleLine.setAttribute("stroke-width", 2);
            $scaleGroup.appendChild($scaleLine);

            // Major ticks and labels
            for (let i = 0; i <= majorTickCount; i++) {
                const x = (i / majorTickCount) * widthRatio;
                const genomicPosition = min + (i / majorTickCount) * width;

                // Major tick mark
                const tickHeight = scaleHeight * 0.4;
                const tickY1 = isTop ? scaleLineY : scaleLineY - tickHeight;
                const tickY2 = isTop ? scaleLineY + tickHeight : scaleLineY;

                const $tick = document.createElementNS("http://www.w3.org/2000/svg", "line");
                $tick.setAttribute("x1", x);
                $tick.setAttribute("y1", tickY1);
                $tick.setAttribute("x2", x);
                $tick.setAttribute("y2", tickY2);
                $tick.setAttribute("stroke", textColor);
                $tick.setAttribute("stroke-width", 2);
                $scaleGroup.appendChild($tick);

                // Format genomic position for display
                let label;
                if (genomicPosition >= 1000000) {
                    label = `${(genomicPosition / 1000000).toFixed(1)}M`;
                } else if (genomicPosition >= 1000) {
                    label = `${(genomicPosition / 1000).toFixed(1)}K`;
                } else {
                    label = Math.round(genomicPosition).toString();
                }

                // Text label
                if (settings.textStyle) {
                    // Position text away from the scale line to avoid strikethrough
                    // For top scale: position text above the scale line (in the upper part of the scale area)
                    // For bottom scale: position text below the scale line (in the lower part of the scale area)
                    const labelY = isTop ? yPosition + scaleHeight * 0.3 : yPosition + scaleHeight * 0.7;
                    const $label = CreateStyledText(label, x, labelY, {
                        ...settings.textStyle,
                        size: Math.max(settings.textStyle.size * 0.8, 30), // Smaller text for scale
                        align: "center"
                    });
                    // Set text baseline to center for better positioning
                    $label.setAttribute("dominant-baseline", "central");
                    $scaleGroup.appendChild($label);
                }

                // Minor ticks between major ticks (except after the last major tick)
                if (i < majorTickCount && minorTickCount > 0) {
                    const step = widthRatio / majorTickCount / (minorTickCount + 1);
                    for (let j = 1; j <= minorTickCount; j++) {
                        const minorX = x + j * step;
                        const minorTickHeight = scaleHeight * 0.2;
                        const minorTickY1 = isTop ? scaleLineY : scaleLineY - minorTickHeight;
                        const minorTickY2 = isTop ? scaleLineY + minorTickHeight : scaleLineY;

                        const $minorTick = document.createElementNS("http://www.w3.org/2000/svg", "line");
                        $minorTick.setAttribute("x1", minorX);
                        $minorTick.setAttribute("y1", minorTickY1);
                        $minorTick.setAttribute("x2", minorX);
                        $minorTick.setAttribute("y2", minorTickY2);
                        $minorTick.setAttribute("stroke", textColor);
                        $minorTick.setAttribute("stroke-width", 1);
                        $minorTick.setAttribute("opacity", "0.6");
                        $scaleGroup.appendChild($minorTick);
                    }
                }
            }

            return $scaleGroup;
        }

        // Add scale(s) based on position setting
        if (settings.scale.position === "top" || settings.scale.position === "both") {
            const $topScale = CreateScale(-scaleHeight, true);
            $svg.appendChild($topScale);
        }

        if (settings.scale.position === "bottom" || settings.scale.position === "both") {
            const $bottomScale = CreateScale(heightRatio, false);
            $svg.appendChild($bottomScale);
        }

        // Adjust SVG viewBox to include scale(s) and text padding
        let newMinY = 0;
        let newHeight = heightRatio;
        let newMinX = -textPadding;
        let newWidth = widthRatio + (textPadding * 2);

        // Add extra padding for text height to prevent cutoff
        const textHeightPadding = settings.textStyle ? scaleHeight * 0.2 : 0;

        if (settings.scale.position === "top" || settings.scale.position === "both") {
            newMinY = -scaleHeight - textHeightPadding;
            newHeight += scaleHeight + textHeightPadding;
        }

        if (settings.scale.position === "bottom" || settings.scale.position === "both") {
            newHeight += scaleHeight + textHeightPadding;
        }

        $svg.setAttribute("viewBox", `${newMinX} ${newMinY} ${newWidth} ${newHeight}`);
    }

    global.hasDrawn = true;
}