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
var script_exports = {};
__export(script_exports, {
  AppType: () => AppType
});
module.exports = __toCommonJS(script_exports);
var import_abstract = require("./abstract");
var AppType;
((AppType2) => {
  class Script extends import_abstract.AppType.AbstractApp {
    constructor(apiClient, adapter, name) {
      super(apiClient, adapter, name);
    }
    getDescription() {
      return "script";
    }
    getIconForObjectTree() {
      return "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NDAgNjQwIj48IS0tIUZvbnQgQXdlc29tZSBGcmVlIDcuMy4xIGJ5IEBmb250YXdlc29tZSAtIGh0dHBzOi8vZm9udGF3ZXNvbWUuY29tIExpY2Vuc2UgLSBodHRwczovL2ZvbnRhd2Vzb21lLmNvbS9saWNlbnNlL2ZyZWUgQ29weXJpZ2h0IDIwMjYgRm9udGljb25zLCBJbmMuLS0+PHBhdGggZD0iTTM5Mi44IDY1LjJDMzc1LjggNjAuMyAzNTguMSA3MC4yIDM1My4yIDg3LjJMMjI1LjIgNTM1LjJDMjIwLjMgNTUyLjIgMjMwLjIgNTY5LjkgMjQ3LjIgNTc0LjhDMjY0LjIgNTc5LjcgMjgxLjkgNTY5LjggMjg2LjggNTUyLjhMNDE0LjggMTA0LjhDNDE5LjcgODcuOCA0MDkuOCA3MC4xIDM5Mi44IDY1LjJ6TTQ1Ny40IDIwMS4zQzQ0NC45IDIxMy44IDQ0NC45IDIzNC4xIDQ1Ny40IDI0Ni42TDUzMC44IDMyMEw0NTcuNCAzOTMuNEM0NDQuOSA0MDUuOSA0NDQuOSA0MjYuMiA0NTcuNCA0MzguN0M0NjkuOSA0NTEuMiA0OTAuMiA0NTEuMiA1MDIuNyA0MzguN0w1OTguNyAzNDIuN0M2MTEuMiAzMzAuMiA2MTEuMiAzMDkuOSA1OTguNyAyOTcuNEw1MDIuNyAyMDEuNEM0OTAuMiAxODguOSA0NjkuOSAxODguOSA0NTcuNCAyMDEuNHpNMTgyLjcgMjAxLjNDMTcwLjIgMTg4LjggMTQ5LjkgMTg4LjggMTM3LjQgMjAxLjNMNDEuNCAyOTcuM0MyOC45IDMwOS44IDI4LjkgMzMwLjEgNDEuNCAzNDIuNkwxMzcuNCA0MzguNkMxNDkuOSA0NTEuMSAxNzAuMiA0NTEuMSAxODIuNyA0MzguNkMxOTUuMiA0MjYuMSAxOTUuMiA0MDUuOCAxODIuNyAzOTMuM0wxMDkuMyAzMjBMMTgyLjYgMjQ2LjZDMTk1LjEgMjM0LjEgMTk1LjEgMjEzLjggMTgyLjYgMjAxLjN6Ii8+PC9zdmc+";
    }
  }
  AppType2.Script = Script;
})(AppType || (AppType = {}));
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AppType
});
//# sourceMappingURL=script.js.map
