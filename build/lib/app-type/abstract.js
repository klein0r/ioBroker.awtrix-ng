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
    nameClean;
    apiClient;
    adapter;
    objPrefix;
    isEnabled;
    slot;
    deviceSlot;
    stateChangeHandler;
    objectChangeHandler;
    constructor(apiClient, adapter, name) {
      this.apiClient = apiClient;
      this.adapter = adapter;
      this.name = name;
      this.nameClean = name.replace(this.adapter.FORBIDDEN_CHARS, "_").replace(/[.\s/]+/g, "_").replace(/_{2,}/g, "_").replace(/^_+|_+$/g, "");
      this.isEnabled = false;
      this.slot = null;
      this.deviceSlot = null;
      if (this.adapter.isMainInstance()) {
        this.objPrefix = this.adapter.namespace;
      } else {
        this.objPrefix = this.adapter.config.foreignSettingsInstance;
      }
      this.stateChangeHandler = this.onStateChange.bind(this);
      this.objectChangeHandler = this.onObjectChange.bind(this);
      adapter.on("stateChange", this.stateChangeHandler);
      adapter.on("objectChange", this.objectChangeHandler);
    }
    /**
     * Stops all timers and event listeners of this app (e.g. instance stopped or app removed from device).
     *
     * @param removeFromDevice - remove the app from the device (if configured and supported by the app type)
     */
    // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
    async unloadAsync(removeFromDevice) {
      this.adapter.removeListener("stateChange", this.stateChangeHandler);
      this.adapter.removeListener("objectChange", this.objectChangeHandler);
    }
    async init(appInfo) {
      var _a, _b, _c;
      const appNameC = this.getNameClean();
      const appEnabledState = await this.adapter.getForeignStateAsync(
        `${this.objPrefix}.apps.${appNameC}.enabled`
      );
      const appSlotState = await this.adapter.getForeignStateAsync(`${this.objPrefix}.apps.${appNameC}.slot`);
      const appInfoDevice = appInfo && appInfo.origin !== "module" ? appInfo : void 0;
      if (appEnabledState && typeof appEnabledState.val === "boolean") {
        this.isEnabled = appEnabledState.val;
      } else {
        this.isEnabled = (_a = appInfoDevice == null ? void 0 : appInfoDevice.enabled) != null ? _a : true;
      }
      this.slot = appSlotState && typeof appSlotState.val === "number" ? appSlotState.val : null;
      this.deviceSlot = (_b = appInfoDevice == null ? void 0 : appInfoDevice.slot) != null ? _b : null;
      if (!appEnabledState || !(appEnabledState == null ? void 0 : appEnabledState.ack) || (appEnabledState == null ? void 0 : appEnabledState.val) !== this.isEnabled) {
        await this.adapter.setState(`apps.${appNameC}.enabled`, {
          val: this.isEnabled,
          ack: true,
          c: "init"
        });
      }
      await this.setAppStatus((_c = appInfo == null ? void 0 : appInfo.present) != null ? _c : false);
    }
    /**
     * Updates the status states of the app (own namespace - status of this device).
     *
     * @param present - app exists on the device (undefined = unchanged)
     * @param lastError - last error message (null = no error, undefined = unchanged)
     */
    async setAppStatus(present, lastError) {
      const appNameC = this.getNameClean();
      try {
        if (present !== void 0) {
          await this.adapter.setStateChangedAsync(`apps.${appNameC}.present`, { val: present, ack: true });
        }
        if (lastError !== void 0) {
          await this.adapter.setStateChangedAsync(`apps.${appNameC}.lastError`, {
            val: lastError,
            ack: true
          });
        }
      } catch (error) {
        this.adapter.log.debug(`[setAppStatus] Unable to update status of app "${this.getName()}": ${error}`);
      }
    }
    /**
     * Creates or replaces the app on the device (pushed app) and updates the status states.
     *
     * @param payload - app definition
     * @param context - description for log messages
     */
    async pushApp(payload, context) {
      const appName = this.getName();
      try {
        await this.apiClient.apps.push(appName, payload);
        await this.setAppStatus(true, null);
        return true;
      } catch (error) {
        this.adapter.log.warn(`[pushApp] Unable to update app "${appName}" (${context}): ${error}`);
        await this.setAppStatus(void 0, error instanceof Error ? error.message : String(error));
        return false;
      }
    }
    /**
     * Removes the app from the device and updates the status states.
     *
     * @param context - description for log messages
     */
    async removeApp(context) {
      const appName = this.getName();
      this.adapter.log.debug(`[removeApp] Going to remove app "${appName}" (${context})`);
      try {
        await this.apiClient.apps.delete(appName);
        await this.setAppStatus(false, null);
        return true;
      } catch (error) {
        this.adapter.log.warn(`[removeApp] Unable to remove app "${appName}" (${context}): ${error}`);
        await this.setAppStatus(void 0, error instanceof Error ? error.message : String(error));
        return false;
      }
    }
    // eslint-disable-next-line @typescript-eslint/require-await
    async refresh() {
      return true;
    }
    getName() {
      return this.name;
    }
    getNameClean() {
      return this.nameClean;
    }
    enabled() {
      return this.isEnabled;
    }
    getSlot() {
      return this.slot;
    }
    /**
     * Position of the app on the device (when it was initialized) - used to sort new apps
     */
    getDeviceSlot() {
      return this.deviceSlot;
    }
    /**
     * Sets the position of the app - just called by the adapter, which keeps all slots dense (0 ... n-1)
     *
     * @param slot - new position
     */
    setSlot(slot) {
      this.slot = slot;
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
      const appNameC = this.getNameClean();
      this.adapter.log.debug(
        `[createObjects] Creating objects for app "${appName}" (${this.isMainInstance() ? "main" : this.objPrefix})`
      );
      await this.adapter.extendObject(`apps.${appNameC}.enabled`, {
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
      await this.adapter.extendObject(`apps.${appNameC}.slot`, {
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
          role: "level",
          read: true,
          write: this.isMainInstance()
        },
        native: {}
      });
      await this.adapter.extendObject(`apps.${appNameC}.present`, {
        type: "state",
        common: {
          name: {
            en: "Present on device",
            de: "Auf dem Ger\xE4t vorhanden",
            ru: "\u041F\u0440\u0438\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u043D\u0430 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0435",
            pt: "Presente no dispositivo",
            nl: "Aanwezig op apparaat",
            fr: "Pr\xE9sent sur l'appareil",
            it: "Presente sul dispositivo",
            es: "Presente en el dispositivo",
            pl: "Obecna na urz\u0105dzeniu",
            uk: "\u041F\u0440\u0438\u0441\u0443\u0442\u043D\u0456\u0439 \u043D\u0430 \u043F\u0440\u0438\u0441\u0442\u0440\u043E\u0457",
            "zh-cn": "\u5B58\u5728\u4E8E\u8BBE\u5907\u4E0A"
          },
          type: "boolean",
          role: "indicator",
          read: true,
          write: false,
          def: false
        },
        native: {}
      });
      await this.adapter.extendObject(`apps.${appNameC}.lastError`, {
        type: "state",
        common: {
          name: {
            en: "Last error",
            de: "Letzter Fehler",
            ru: "\u041F\u043E\u0441\u043B\u0435\u0434\u043D\u044F\u044F \u043E\u0448\u0438\u0431\u043A\u0430",
            pt: "\xDAltimo erro",
            nl: "Laatste fout",
            fr: "Derni\xE8re erreur",
            it: "Ultimo errore",
            es: "\xDAltimo error",
            pl: "Ostatni b\u0142\u0105d",
            uk: "\u041E\u0441\u0442\u0430\u043D\u043D\u044F \u043F\u043E\u043C\u0438\u043B\u043A\u0430",
            "zh-cn": "\u6700\u540E\u4E00\u4E2A\u9519\u8BEF"
          },
          type: "string",
          role: "text",
          read: true,
          write: false
        },
        native: {}
      });
      if (!this.isMainInstance()) {
        await this.adapter.subscribeForeignStatesAsync(`${this.objPrefix}.apps.${appNameC}.enabled`);
        await this.adapter.subscribeForeignStatesAsync(`${this.objPrefix}.apps.${appNameC}.slot`);
      }
      if (this.hasOwnActivateState()) {
        await this.adapter.extendObject(`apps.${appNameC}.activate`, {
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
        await this.adapter.delObjectAsync(`apps.${appNameC}.activate`);
        await this.adapter.subscribeForeignStatesAsync(`${this.objPrefix}.apps.${appNameC}.activate`);
      }
    }
    async onStateChange(id, state) {
      const appName = this.getName();
      const appNameC = this.getNameClean();
      if (id) {
        if (state && !state.ack) {
          if (id === `${this.hasOwnActivateState() ? this.adapter.namespace : this.objPrefix}.apps.${appNameC}.activate`) {
            if (state.val) {
              if (this.isEnabled) {
                this.apiClient.apps.switchTo(appName).then(async () => {
                  const idOwnNamespace = this.getObjIdOwnNamespace(id);
                  await this.adapter.setState(idOwnNamespace, { val: state.val, ack: true });
                }).catch((error) => {
                  this.adapter.log.warn(
                    `[onStateChange] ${appName}: (apps/activate) Unable to execute action: ${error}`
                  );
                });
              } else {
                this.adapter.log.warn(
                  `[onStateChange] ${appName}: App is not enabled - unable to activate`
                );
              }
            } else {
              this.adapter.log.warn(`[onStateChange] ${appName}: Received invalid value for state ${id}`);
            }
          }
        }
      }
      await this.stateChanged(id, state);
    }
    async stateChanged(id, state) {
      if (id && state && !this.isMainInstance() && id === `${this.objPrefix}.apps.${this.getNameClean()}.slot`) {
        this.adapter.scheduleAppOrderSync();
        return;
      }
      if (id && state && !state.ack) {
        const appName = this.getName();
        const appNameC = this.getNameClean();
        const idOwnNamespace = this.getObjIdOwnNamespace(id);
        if (id === `${this.objPrefix}.apps.${appNameC}.enabled`) {
          const enabled = !!state.val;
          this.adapter.log.debug(`[onStateChange] ${appName}: Enabled of app changed to ${enabled}`);
          await this.apiClient.apps.setEnabled(appName, enabled).then(async () => {
            this.isEnabled = enabled;
            await this.adapter.setState(idOwnNamespace, {
              val: enabled,
              ack: true,
              c: `onStateChange ${this.objPrefix}`
            });
          }).catch((error) => {
            this.adapter.log.warn(
              `[onStateChange] ${appName}: Unable to change enabled state of app: ${error}`
            );
          });
        } else if (id === `${this.objPrefix}.apps.${appNameC}.slot`) {
          if (typeof state.val === "number" && Number.isFinite(state.val)) {
            this.adapter.log.debug(`[onStateChange] ${appName}: Moving app to position ${state.val}`);
            await this.adapter.moveApp(this, state.val);
          } else {
            this.adapter.log.warn(
              `[onStateChange] ${appName}: Invalid position "${state.val}" - expected a number`
            );
            await this.adapter.setState(idOwnNamespace, {
              val: this.slot,
              ack: true,
              c: "invalid value"
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
