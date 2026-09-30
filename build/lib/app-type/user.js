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
    keepAliveTimeout;
    /** Interval to transfer the app again (if a lifetime is used) */
    static KEEP_ALIVE_INTERVAL_MS = 5 * 60 * 1e3;
    constructor(apiClient, adapter, definition) {
      super(apiClient, adapter, definition.name);
      this.definition = definition;
      this.ignoreNewValueForAppInTimeRange = Math.min(adapter.config.ignoreNewValueForAppInTimeRange, 10);
      this.keepAliveTimeout = void 0;
    }
    /**
     * Apps get a lifetime if they should be removed when the instance is stopped. So they
     * disappear from the device if the adapter is not running anymore (e.g. after a crash).
     */
    useLifetime() {
      return !!this.adapter.config.removeAppsOnStop;
    }
    /**
     * Lifetime options for the app payload (just if lifetime is used)
     */
    getLifetimeOptions() {
      if (this.useLifetime()) {
        return { lifetimeMs: UserApp.KEEP_ALIVE_INTERVAL_MS + 60 * 1e3 };
      }
      return {};
    }
    /**
     * Transfers the app again before the lifetime ends (even if the value did not change)
     */
    scheduleKeepAlive() {
      if (!this.useLifetime()) {
        return;
      }
      this.clearKeepAlive();
      this.keepAliveTimeout = this.adapter.setTimeout(async () => {
        this.keepAliveTimeout = void 0;
        if (this.adapter.isApiConnected()) {
          this.adapter.log.debug(`[keepAlive] Transferring app "${this.getName()}" again`);
          await this.refresh();
        } else {
          this.scheduleKeepAlive();
        }
      }, UserApp.KEEP_ALIVE_INTERVAL_MS);
    }
    clearKeepAlive() {
      if (this.keepAliveTimeout) {
        this.adapter.clearTimeout(this.keepAliveTimeout);
        this.keepAliveTimeout = void 0;
      }
    }
    async unloadAsync(removeFromDevice) {
      this.clearKeepAlive();
      if (removeFromDevice && this.adapter.config.removeAppsOnStop) {
        this.adapter.log.info(`[onUnload] Deleting app on awtrix light with name "${this.definition.name}"`);
        await this.removeApp("instance stopped");
      }
      await super.unloadAsync(removeFromDevice);
    }
  }
  AppType2.UserApp = UserApp;
})(AppType || (AppType = {}));
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AppType
});
//# sourceMappingURL=user.js.map
