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
var user_exports = {};
__export(user_exports, {
  AppType: () => AppType
});
module.exports = __toCommonJS(user_exports);
var import_abstract = require("./abstract");
var AppType;
((AppType2) => {
  class UserApp extends import_abstract.AppType.AbstractApp {
    definition;
    ignoreNewValueForAppInTimeRange;
    constructor(apiClient, adapter, definition) {
      super(apiClient, adapter, definition.name);
      this.definition = definition;
      this.ignoreNewValueForAppInTimeRange = adapter.config.ignoreNewValueForAppInTimeRange;
    }
    async unloadAsync() {
      if (this.adapter.config.removeAppsOnStop) {
        this.adapter.log.info(`[onUnload] Deleting app on awtrix light with name "${this.definition.name}"`);
        try {
          await this.apiClient.removeAppAsync(this.definition.name).catch((error) => {
            this.adapter.log.warn(`Unable to remove unknown app "${this.definition.name}": ${error}`);
          });
        } catch (error) {
          this.adapter.log.error(`[onUnload] Unable to delete app ${this.definition.name}: ${error}`);
        }
      }
    }
  }
  AppType2.UserApp = UserApp;
})(AppType || (AppType = {}));
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AppType
});
//# sourceMappingURL=user.js.map
