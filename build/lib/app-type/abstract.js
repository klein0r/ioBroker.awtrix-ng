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
var abstract_exports = {};
__export(abstract_exports, {
  AppType: () => AppType
});
module.exports = __toCommonJS(abstract_exports);
var AppType;
((AppType2) => {
  class AbstractApp {
    name;
    apiClient;
    adapter;
    objPrefix;
    isEnabled;
    slot;
    constructor(apiClient, adapter, name) {
      this.name = name;
      this.isEnabled = false;
      this.slot = null;
      this.apiClient = apiClient;
      this.adapter = adapter;
      if (this.adapter.isMainInstance()) {
        this.objPrefix = this.adapter.namespace;
      } else {
        this.objPrefix = this.adapter.config.foreignSettingsInstance;
      }
      adapter.on("stateChange", this.onStateChange.bind(this));
      adapter.on("objectChange", this.onObjectChange.bind(this));
    }
    async init(orderDefinition) {
      var _a, _b;
      const appName = this.getName();
      const appEnabledState = await this.adapter.getForeignStateAsync(
        `${this.objPrefix}.apps.${appName}.enabled`
      );
      const appSlotState = await this.adapter.getForeignStateAsync(
        `${this.objPrefix}.apps.${appName}.slot`
      );
      if (orderDefinition) {
        this.isEnabled = (_a = orderDefinition == null ? void 0 : orderDefinition.enabled) != null ? _a : true;
        this.slot = (_b = orderDefinition == null ? void 0 : orderDefinition.slot) != null ? _b : null;
      } else {
        this.isEnabled = appEnabledState && typeof (appEnabledState == null ? void 0 : appEnabledState.val) === "boolean" ? !!appEnabledState.val : true;
        this.slot = appSlotState && typeof (appSlotState == null ? void 0 : appSlotState.val) === "number" ? appSlotState.val : null;
      }
      if (!appEnabledState || !(appEnabledState == null ? void 0 : appEnabledState.ack) || (appEnabledState == null ? void 0 : appEnabledState.val) !== this.isEnabled) {
        await this.adapter.setState(`apps.${appName}.enabled`, { val: this.isEnabled, ack: true, c: "init" });
      }
      if (!appSlotState || !(appSlotState == null ? void 0 : appSlotState.ack) || (appSlotState == null ? void 0 : appSlotState.val) !== this.slot) {
        await this.adapter.setState(`apps.${appName}.slot`, { val: this.slot, ack: true, c: "init" });
      }
    }
    // eslint-disable-next-line @typescript-eslint/require-await
    async refresh() {
      return true;
    }
    getName() {
      return this.name;
    }
    enabled() {
      return this.isEnabled;
    }
    getSlot() {
      return this.slot;
    }
    isMainInstance() {
      return this.adapter.isMainInstance();
    }
    getObjIdOwnNamespace(id) {
      return this.adapter.removeNamespace(
        this.isMainInstance() ? id : id.replace(this.objPrefix, this.adapter.namespace)
      );
    }
    hasOwnActivateState() {
      return this.isMainInstance() || !this.adapter.config.foreignSettingsInstanceActivateApps;
    }
    async createObjects() {
      const appName = this.getName();
      this.adapter.log.debug(
        `[createObjects] Creating objects for app "${appName}" (${this.isMainInstance() ? "main" : this.objPrefix})`
      );
      await this.adapter.extendObject(`apps.${appName}.enabled`, {
        type: "state",
        common: {
          name: {
            en: "Enabled",
            de: "Aktiviert",
            ru: "\u0412\u043A\u043B\u044E\u0447\u0435\u043D\u043E",
            pt: "Ativado",
            nl: "Ingeschakeld",
            fr: "Activ\xE9",
            it: "Abilitato",
            es: "Activado",
            pl: "W\u0142\u0105czone",
            uk: "\u0423\u0432\u0456\u043C\u043A\u043D\u0435\u043D\u043E",
            "zh-cn": "\u5DF2\u555F\u7528"
          },
          type: "boolean",
          role: "switch.enable",
          read: true,
          write: this.isMainInstance(),
          def: true
        },
        native: {}
      });
      await this.adapter.extendObject(`apps.${appName}.slot`, {
        type: "state",
        common: {
          name: {
            en: "Position in loop",
            de: "Position in der Schleife",
            ru: "\u041F\u043E\u0437\u0438\u0446\u0438\u044F \u0432 \u0446\u0438\u043A\u043B\u0435",
            pt: "Posi\xE7\xE3o no ciclo",
            nl: "Positie in de lus",
            fr: "Position dans la boucle",
            it: "Posizione nel ciclo",
            es: "Posici\xF3n en el bucle",
            pl: "Pozycja w p\u0119tli",
            uk: "\u041F\u043E\u0437\u0438\u0446\u0456\u044F \u0432 \u0446\u0438\u043A\u043B\u0456",
            "zh-cn": "Position in loop"
          },
          type: "number",
          role: "value",
          read: true,
          write: this.isMainInstance()
        },
        native: {}
      });
      if (!this.isMainInstance()) {
        await this.adapter.subscribeForeignStatesAsync(`${this.objPrefix}.apps.${appName}.enabled`);
        await this.adapter.subscribeForeignStatesAsync(`${this.objPrefix}.apps.${appName}.slot`);
      }
      if (this.hasOwnActivateState()) {
        await this.adapter.extendObject(`apps.${appName}.activate`, {
          type: "state",
          common: {
            name: {
              en: "Activate",
              de: "Aktivieren",
              ru: "\u0410\u043A\u0442\u0438\u0432\u0438\u0440\u043E\u0432\u0430\u0442\u044C",
              pt: "Ativar",
              nl: "Activeren",
              fr: "Activer",
              it: "Attivare",
              es: "Activar",
              pl: "Aktywuj",
              uk: "\u0410\u043A\u0442\u0438\u0432\u0443\u0432\u0430\u0442\u0438",
              "zh-cn": "\u542F\u7528"
            },
            type: "boolean",
            role: "button",
            read: false,
            write: true
          },
          native: {}
        });
      } else {
        await this.adapter.delObjectAsync(`apps.${appName}.activate`);
        await this.adapter.subscribeForeignStatesAsync(`${this.objPrefix}.apps.${appName}.activate`);
      }
    }
    async onStateChange(id, state) {
      const appName = this.getName();
      if (id) {
        if (state && !state.ack) {
          if (id === `${this.hasOwnActivateState() ? this.adapter.namespace : this.objPrefix}.apps.${appName}.activate`) {
            if (state.val) {
              if (this.isEnabled) {
                this.apiClient.requestAsync("apps/active", "PUT", { name: appName }).then(async (response) => {
                  if (response.status === 200 && response.data.ok === true) {
                    const idOwnNamespace = this.getObjIdOwnNamespace(id);
                    await this.adapter.setState(idOwnNamespace, { val: state.val, ack: true });
                  }
                }).catch((error) => {
                  this.adapter.log.warn(
                    `[onStateChange] ${appName}: (apps/activate) Unable to execute action: ${error}`
                  );
                });
              } else {
                this.adapter.log.warn(`[onStateChange] ${appName}: App is not enabled - unable to activate`);
              }
            } else {
              this.adapter.log.warn(`[onStateChange] ${appName}: Received invalid value for state ${id}`);
            }
          }
        }
      }
      await this.stateChanged(id, state);
    }
    /* eslint-disable @typescript-eslint/no-unused-vars */
    async stateChanged(id, state) {
      if (id && state && !state.ack) {
        const appName = this.getName();
        const idOwnNamespace = this.getObjIdOwnNamespace(id);
        if (id === `${this.objPrefix}.apps.${appName}.enabled`) {
          if (state.val !== this.isEnabled) {
            this.adapter.log.debug(
              `[onStateChange] ${appName}: Enabled of app ${appName} changed to ${state.val}`
            );
            this.isEnabled = !!state.val;
            this.adapter.refreshAppOrder();
            await this.adapter.setState(idOwnNamespace, {
              val: state.val,
              ack: true,
              c: `onStateChange ${this.objPrefix}`
            });
          } else {
            this.adapter.log.debug(
              `[onStateChange] ${appName}: Enabled of app "${appName}" IGNORED (not changed): ${state.val}`
            );
            await this.adapter.setState(idOwnNamespace, {
              val: state.val,
              ack: true,
              c: `onStateChange ${this.objPrefix} (unchanged)`
            });
          }
        } else if (id === `${this.objPrefix}.apps.${appName}.slot` && typeof state.val === "number") {
          if (state.val !== this.slot) {
            this.adapter.log.debug(
              `[onStateChange] ${appName}: Slot of app ${appName} changed to ${state.val}`
            );
            this.slot = state.val;
            this.adapter.refreshAppOrder();
            await this.adapter.setState(idOwnNamespace, {
              val: state.val,
              ack: true,
              c: `onStateChange ${this.objPrefix}`
            });
          } else {
            this.adapter.log.debug(
              `[onStateChange] ${appName}: Slot of app "${appName}" IGNORED (not changed): ${state.val}`
            );
            await this.adapter.setState(idOwnNamespace, {
              val: state.val,
              ack: true,
              c: `onStateChange ${this.objPrefix} (unchanged)`
            });
          }
        }
      }
    }
    async onObjectChange(id, obj) {
      await this.objectChanged(id, obj);
    }
    /* eslint-disable @typescript-eslint/no-unused-vars */
    async objectChanged(id, obj) {
    }
  }
  AppType2.AbstractApp = AbstractApp;
})(AppType || (AppType = {}));
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AppType
});
//# sourceMappingURL=abstract.js.map
