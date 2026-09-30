import type { ScreenBuffer } from 'awtrix-ng-api';
import { toHexColor } from 'awtrix-ng-api';

/** Size of one pixel in the SVG */
const PIXEL_SIZE = 20;

/**
 * Converts the screen buffer of the device (packed 0xRRGGBB integers, row-major) into a compact SVG:
 * one path per color (horizontal runs of the same color are merged) and one path for the grid lines on top.
 *
 * @param screen - screen buffer of GET display/screen
 */
export function screenToSvg(screen: ScreenBuffer): string {
    const { width, height, pixels } = screen;

    // color -> path data
    const paths = new Map<number, string>();

    for (let y = 0; y < height; y++) {
        let x = 0;
        while (x < width) {
            const color = pixels[y * width + x] ?? 0;
            const startX = x;

            while (x < width && (pixels[y * width + x] ?? 0) === color) {
                x++;
            }

            const runLength = x - startX;
            paths.set(color, `${paths.get(color) ?? ''}M${startX} ${y}h${runLength}v1h-${runLength}z`);
        }
    }

    let svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width * PIXEL_SIZE}" height="${height * PIXEL_SIZE}" ` +
        `viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">`;

    for (const [color, d] of paths) {
        svg += `<path fill="${toHexColor(color)}" d="${d}"/>`;
    }

    // Grid lines between the pixels (2px at PIXEL_SIZE 20)
    let grid = '';
    for (let x = 0; x <= width; x++) {
        grid += `M${x} 0V${height}`;
    }
    for (let y = 0; y <= height; y++) {
        grid += `M0 ${y}H${width}`;
    }

    svg += `<path fill="none" stroke="#000000" stroke-width="0.1" d="${grid}"/></svg>`;

    return svg;
}
