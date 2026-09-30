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
var history_exports = {};
__export(history_exports, {
  AppType: () => AppType
});
module.exports = __toCommonJS(history_exports);
var import_user = require("../user");
var AppType;
((AppType2) => {
  class History extends import_user.AppType.UserApp {
    appDefinition;
    isValidSourceInstance;
    isValidObjId;
    refreshTimeout;
    constructor(apiClient, adapter, definition) {
      super(apiClient, adapter, definition);
      this.appDefinition = definition;
      this.isValidSourceInstance = false;
      this.isValidObjId = false;
      this.refreshTimeout = void 0;
    }
    getDescription() {
      return "history";
    }
    getIconForObjectTree() {
      return "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0NDggNTEyIj48IS0tIUZvbnQgQXdlc29tZSBGcmVlIDYuNy4yIGJ5IEBmb250YXdlc29tZSAtIGh0dHBzOi8vZm9udGF3ZXNvbWUuY29tIExpY2Vuc2UgLSBodHRwczovL2ZvbnRhd2Vzb21lLmNvbS9saWNlbnNlL2ZyZWUgQ29weXJpZ2h0IDIwMjUgRm9udGljb25zLCBJbmMuLS0+PHBhdGggZD0iTTE2MCA4MGMwLTI2LjUgMjEuNS00OCA0OC00OGwzMiAwYzI2LjUgMCA0OCAyMS41IDQ4IDQ4bDAgMzUyYzAgMjYuNS0yMS41IDQ4LTQ4IDQ4bC0zMiAwYy0yNi41IDAtNDgtMjEuNS00OC00OGwwLTM1MnpNMCAyNzJjMC0yNi41IDIxLjUtNDggNDgtNDhsMzIgMGMyNi41IDAgNDggMjEuNSA0OCA0OGwwIDE2MGMwIDI2LjUtMjEuNSA0OC00OCA0OGwtMzIgMGMtMjYuNSAwLTQ4LTIxLjUtNDgtNDhMMCAyNzJ6TTM2OCA5NmwzMiAwYzI2LjUgMCA0OCAyMS41IDQ4IDQ4bDAgMjg4YzAgMjYuNS0yMS41IDQ4LTQ4IDQ4bC0zMiAwYy0yNi41IDAtNDgtMjEuNS00OC00OGwwLTI4OGMwLTI2LjUgMjEuNS00OCA0OC00OHoiLz48L3N2Zz4=";
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async init(appInfo) {
      await this.validateSource(true);
      await super.init();
    }
    /**
     * Checks if the source instance is running and if logging is configured for objId.
     * Warnings are just logged on init - later checks (on every refresh while invalid) log as debug.
     */
    async validateSource(isInit) {
      var _a, _b, _c;
      const logWarn = (msg) => isInit ? this.adapter.log.warn(msg) : this.adapter.log.debug(msg);
      const logInfo = (msg) => isInit ? this.adapter.log.info(msg) : this.adapter.log.debug(msg);
      this.isValidSourceInstance = false;
      this.isValidObjId = false;
      try {
        if (this.appDefinition.sourceInstance) {
          const sourceInstanceObj = await this.adapter.getForeignObjectAsync(
            `system.adapter.${this.appDefinition.sourceInstance}`
          );
          if (sourceInstanceObj && ((_a = sourceInstanceObj.common) == null ? void 0 : _a.getHistory)) {
            const sourceInstanceAliveState = await this.adapter.getForeignStateAsync(
              `system.adapter.${this.appDefinition.sourceInstance}.alive`
            );
            if (sourceInstanceAliveState && sourceInstanceAliveState.val) {
              this.adapter.log.debug(
                `[initHistoryApp] Found valid source instance for history data: ${this.appDefinition.sourceInstance}`
              );
              this.isValidSourceInstance = true;
            } else {
              logWarn(
                `[initHistoryApp] Unable to get history data of "${this.appDefinition.sourceInstance}": instance not running (stopped)`
              );
            }
          } else {
            logWarn(
              `[initHistoryApp] Unable to get history data of "${this.appDefinition.sourceInstance}": no valid source for getHistory()`
            );
          }
        }
        if (this.appDefinition.objId) {
          this.adapter.log.debug(
            `[initHistoryApp] getting history data for app "${this.appDefinition.name}" of "${this.appDefinition.objId}" from ${this.appDefinition.sourceInstance}`
          );
          if (this.isValidSourceInstance) {
            const sourceObj = await this.adapter.getForeignObjectAsync(this.appDefinition.objId);
            if (sourceObj && Object.prototype.hasOwnProperty.call(
              (_c = (_b = sourceObj == null ? void 0 : sourceObj.common) == null ? void 0 : _b.custom) != null ? _c : {},
              this.appDefinition.sourceInstance
            )) {
              this.isValidObjId = true;
            } else {
              logInfo(
                `[initHistoryApp] Unable to get data for app "${this.appDefinition.name}" of "${this.appDefinition.objId}": logging is not configured for this object`
              );
            }
          } else {
            logInfo(
              `[initHistoryApp] Unable to get data for app "${this.appDefinition.name}" of "${this.appDefinition.objId}": source invalid or unavailable`
            );
          }
        }
      } catch (error) {
        this.adapter.log.error(
          `[initHistoryApp] Unable to get data for app "${this.appDefinition.name}" of "${this.appDefinition.objId}": ${error}`
        );
      }
    }
    async refresh() {
      var _a;
      let refreshed = false;
      try {
        if (await super.refresh()) {
          if (!this.isValidSourceInstance || !this.isValidObjId) {
            await this.validateSource(false);
          }
          if (this.isValidSourceInstance && this.isValidObjId) {
            refreshed = await this.refreshHistoryData();
          }
        }
      } catch (error) {
        this.adapter.log.warn(
          `[refreshHistoryApp] Unable to refresh app "${this.appDefinition.name}": ${error}`
        );
      }
      this.adapter.log.debug(
        `re-creating history apps timeout (${(_a = this.adapter.config.historyAppsRefreshInterval) != null ? _a : 300} seconds)`
      );
      this.refreshTimeout = this.refreshTimeout || this.adapter.setTimeout(
        async () => {
          this.refreshTimeout = void 0;
          await this.refresh();
        },
        this.adapter.config.historyAppsRefreshInterval * 1e3 || 5 * 60 * 1e3
      );
      return refreshed;
    }
    async refreshHistoryData() {
      const itemCount = this.appDefinition.icon ? 11 : 16;
      const options = {
        start: 1,
        end: Date.now(),
        limit: itemCount,
        returnNewestEntries: true,
        ignoreNull: 0,
        removeBorderValues: true,
        ack: true
      };
      if (this.appDefinition.mode == "aggregate") {
        options.aggregate = this.appDefinition.aggregation;
        options.step = this.appDefinition.step ? this.appDefinition.step * 1e3 : 36e5;
      } else {
        options.aggregate = "none";
      }
      this.adapter.log.debug(
        `[refreshHistoryApp] Getting history for app "${this.appDefinition.name}" of "${this.appDefinition.objId}" with options: ${JSON.stringify(options)}`
      );
      const historyData = await this.adapter.sendToAsync(
        this.appDefinition.sourceInstance,
        "getHistory",
        {
          id: this.appDefinition.objId,
          options
        },
        { timeout: 3e4 }
      );
      const result = historyData == null ? void 0 : historyData.result;
      const graphData = (Array.isArray(result) ? result : []).filter((state) => typeof (state == null ? void 0 : state.val) === "number" && state.ack).map((state) => Math.round(state.val)).slice(itemCount * -1);
      this.adapter.log.debug(
        `[refreshHistoryApp] Data for app "${this.appDefinition.name}" of "${this.appDefinition.objId}": ${JSON.stringify(historyData)} - filtered: ${JSON.stringify(graphData)}`
      );
      if (graphData.length > 0) {
        const moreOptions = {};
        if (this.appDefinition.duration > 0) {
          moreOptions.durationMs = this.appDefinition.duration * 1e3;
        }
        if (this.appDefinition.repeat > 0) {
          moreOptions.repeat = this.appDefinition.repeat;
        }
        if (this.appDefinition.display == "bar") {
          moreOptions.barChart = graphData;
        } else {
          moreOptions.lineChart = graphData;
        }
        await this.pushApp(
          {
            chartColor: this.appDefinition.lineColor || "#FF0000",
            backgroundColor: this.appDefinition.backgroundColor || "#000000",
            chartAutoscale: true,
            icon: this.appDefinition.icon,
            lifetimeMs: (this.adapter.config.historyAppsRefreshInterval + 60) * 1e3,
            // Remove app if there is no update in configured interval (+ buffer)
            ...moreOptions
          },
          "history data"
        );
        return true;
      }
      await this.removeApp("no history data");
      return false;
    }
    async unloadAsync(removeFromDevice) {
      if (this.refreshTimeout) {
        this.adapter.log.debug(`clearing history app timeout for "${this.getName()}"`);
        this.adapter.clearTimeout(this.refreshTimeout);
        this.refreshTimeout = void 0;
      }
      await super.unloadAsync(removeFromDevice);
    }
  }
  AppType2.History = History;
})(AppType || (AppType = {}));
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AppType
});
//# sourceMappingURL=history.js.map
