"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var screen_exports = {};
__export(screen_exports, {
  screenToSvg: () => screenToSvg
});
module.exports = __toCommonJS(screen_exports);
var import_awtrix_ng_api = require("awtrix-ng-api");
const PIXEL_SIZE = 20;
function screenToSvg(screen) {
  var _a, _b, _c;
  const { width, height, pixels } = screen;
  const paths = /* @__PURE__ */ new Map();
  for (let y = 0; y < height; y++) {
    let x = 0;
    while (x < width) {
      const color = (_a = pixels[y * width + x]) != null ? _a : 0;
      const startX = x;
      while (x < width && ((_b = pixels[y * width + x]) != null ? _b : 0) === color) {
        x++;
      }
      const runLength = x - startX;
      paths.set(color, `${(_c = paths.get(color)) != null ? _c : ""}M${startX} ${y}h${runLength}v1h-${runLength}z`);
    }
  }
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width * PIXEL_SIZE}" height="${height * PIXEL_SIZE}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">`;
  for (const [color, d] of paths) {
    svg += `<path fill="${(0, import_awtrix_ng_api.toHexColor)(color)}" d="${d}"/>`;
  }
  let grid = "";
  for (let x = 0; x <= width; x++) {
    grid += `M${x} 0V${height}`;
  }
  for (let y = 0; y <= height; y++) {
    grid += `M0 ${y}H${width}`;
  }
  svg += `<path fill="none" stroke="#000000" stroke-width="0.1" d="${grid}"/></svg>`;
  return svg;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  screenToSvg
});
//# sourceMappingURL=screen.js.map
