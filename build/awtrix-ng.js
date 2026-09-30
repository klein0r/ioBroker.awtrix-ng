"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var awtrix_ng_exports = {};
__export(awtrix_ng_exports, {
  AwtrixNg: () => AwtrixNg
});
module.exports = __toCommonJS(awtrix_ng_exports);
var utils = __toESM(require("@iobroker/adapter-core"));
var import_awtrix_ng_api = require("awtrix-ng-api");
var import_builtin = require("./lib/app-type/builtin");
var import_script = require("./lib/app-type/script");
var import_user = require("./lib/app-type/user");
var import_custom = require("./lib/app-type/user/custom");
var import_expert = require("./lib/app-type/user/expert");
var import_history = require("./lib/app-type/user/history");
class AwtrixNg extends utils.Adapter {
  _isMainInstance;
  currentVersion;
  supportedVersion;
  displayedVersionWarning;
  apiClient;
  apiConnected;
  lastConnectionError;
  lastUptimeSeconds;
  welcomeSent;
  refreshStateTimeout;
  downloadScreenContentInterval;
  apps;
  backgroundEffects;
  weatherOverlays;
  palettes;
  paletteEffects;
  constructor(options = {}) {
    super({
      ...options,
      name: "awtrix-ng",
      useFormatDate: true
    });
    this._isMainInstance = true;
    this.currentVersion = void 0;
    this.supportedVersion = "1.1.2";
    this.displayedVersionWarning = false;
    this.apiClient = null;
    this.apiConnected = false;
    this.lastConnectionError = void 0;
    this.lastUptimeSeconds = void 0;
    this.welcomeSent = false;
    this.refreshStateTimeout = void 0;
    this.downloadScreenContentInterval = void 0;
    this.apps = [];
    this.backgroundEffects = [
      "BrickBreaker",
      "Checkerboard",
      "ColorWaves",
      "Fade",
      "Fireworks",
      "LookingEyes",
      "Matrix",
      "MovingLine",
      "Pacifica",
      "PingPong",
      "Plasma",
      "PlasmaCloud",
      "Radar",
      "Ripple",
      "Snake",
      "SwirlIn",
      "SwirlOut",
      "TheaterChase",
      "TwinklingStars"
    ];
    this.weatherOverlays = ["rain", "snow", "drizzle", "storm", "thunder", "frost"];
    this.palettes = ["Cloud", "Lava", "Ocean", "Forest", "Stripe", "Party", "Heat", "Rainbow"];
    this.paletteEffects = [
      "Checkerboard",
      "ColorWaves",
      "Fade",
      "Fireworks",
      "MovingLine",
      "Pacifica",
      "Plasma",
      "PlasmaCloud",
      "Radar",
      "Ripple",
      "Snake",
      "SwirlIn",
      "SwirlOut",
      "TheaterChase",
      "TwinklingStars"
    ];
    this.on("ready", this.onReady.bind(this));
    this.on("stateChange", this.onStateChange.bind(this));
    this.on("objectChange", this.onObjectChange.bind(this));
    this.on("message", this.onMessage.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  async onReady() {
    await this.setApiConnected(false);
    await this.subscribeStatesAsync("*");
    if (!this.config.awtrixIp) {
      this.log.error(`IP address not configured - please check instance configuration and restart`);
      return;
    }
    try {
      this.apiClient = new import_awtrix_ng_api.AwtrixClient({
        host: this.config.awtrixIp,
        port: this.config.awtrixPort || 80,
        timeout: this.config.httpTimeout * 1e3 || 3e3,
        auth: this.config.userName ? { username: this.config.userName, password: this.config.userPassword } : void 0
      });
    } catch (error) {
      this.log.error(`Unable to create API client - please check instance configuration: ${error}`);
      return;
    }
    this.log.info(`Starting - connecting to ${this.apiClient.baseUrl}/`);
    if (this.config.foreignSettingsInstance !== "" && this.config.foreignSettingsInstance !== this.namespace) {
      this._isMainInstance = false;
      await this.subscribeForeignObjectsAsync(`system.adapter.${this.config.foreignSettingsInstance}`);
      await this.importForeignSettings();
    }
    this.refreshState();
  }
  async importForeignSettings() {
    var _a, _b, _c;
    try {
      this.log.info(`Using settings of other instance: ${this.config.foreignSettingsInstance}`);
      const instanceObj = await this.getForeignObjectAsync(
        `system.adapter.${this.config.foreignSettingsInstance}`
      );
      if (instanceObj && instanceObj.native) {
        if (!((_a = instanceObj.native) == null ? void 0 : _a.foreignSettingsInstance)) {
          this.config.customApps = instanceObj.native.customApps;
          this.config.ignoreNewValueForAppInTimeRange = instanceObj.native.ignoreNewValueForAppInTimeRange;
          this.config.historyApps = instanceObj.native.historyApps;
          this.config.historyAppsRefreshInterval = instanceObj.native.historyAppsRefreshInterval;
          this.config.removeAppsOnStop = instanceObj.native.removeAppsOnStop;
          this.config.expertApps = instanceObj.native.expertApps;
          this.log.debug(
            `[importForeignSettings] Copied settings from foreign instance "system.adapter.${this.config.foreignSettingsInstance}"`
          );
        } else {
          throw new Error(
            `Foreign instance uses instance settings of ${(_b = instanceObj == null ? void 0 : instanceObj.native) == null ? void 0 : _b.foreignSettingsInstance} - (nothing imported)`
          );
        }
      } else {
        throw new Error(
          `Unable to load instance settings of ${(_c = instanceObj == null ? void 0 : instanceObj.native) == null ? void 0 : _c.foreignSettingsInstance} (nothing imported)`
        );
      }
    } catch (err) {
      this.log.error(`Unable to import settings of other instance: ${err}`);
    }
  }
  isMainInstance() {
    return this._isMainInstance;
  }
  async onStateChange(id, state) {
    var _a;
    if (id && state && !state.ack) {
      const idNoNamespace = this.removeNamespace(id);
      this.log.debug(`state ${idNoNamespace} changed: ${state.val}`);
      if (this.apiClient && this.apiConnected) {
        if (idNoNamespace.startsWith("settings.")) {
          this.log.debug(`changing setting ${idNoNamespace} power to ${state.val}`);
          const settingsObj = await this.getObjectAsync(idNoNamespace);
          if (settingsObj && ((_a = settingsObj.native) == null ? void 0 : _a.settingsKey)) {
            const settingsKey = settingsObj.native.settingsKey;
            const settingsUpdate = settingsKey.split(".").reduceRight((acc, key) => ({ [key]: acc }), state.val);
            this.apiClient.settings.update(settingsUpdate).then(async () => {
              await this.setState(idNoNamespace, { val: state.val, ack: true });
              await this.refreshSettings();
            }).catch((error) => {
              this.log.warn(`(settings) Unable to execute action: ${error}`);
            });
          } else {
            this.log.warn(`Unable to change setting of ${id} - settingsKey not found`);
          }
        } else if (idNoNamespace === "display.power") {
          this.log.debug(`changing display power to ${state.val}`);
          this.apiClient.display.setPower(!!state.val).then(async () => {
            await this.setState(idNoNamespace, { val: state.val, ack: true });
          }).catch((error) => {
            this.log.warn(`(power) Unable to execute action: ${error}`);
          });
        } else if (idNoNamespace === "device.sleep") {
          this.log.debug(`enable sleep mode of device for ${state.val} seconds`);
          this.apiClient.device.sleep(Number(state.val)).then(async () => {
            await this.setState(idNoNamespace, { val: state.val, ack: true });
            await this.setApiConnected(false);
          }).catch((error) => {
            this.log.warn(`(device/sleep) Unable to execute action: ${error}`);
          });
        } else if (idNoNamespace.startsWith("display.moodlight.")) {
          this.updateMoodlightByStates().then(async () => {
            await this.setState(idNoNamespace, { val: state.val, ack: true });
          }).catch((error) => {
            this.log.warn(`(moodlight) Unable to execute action: ${error}`);
          });
        } else if (idNoNamespace === "device.reboot") {
          this.apiClient.device.reboot().then(async () => {
            this.log.info("rebooting device");
            await this.setState(idNoNamespace, { val: state.val, ack: true });
            await this.setApiConnected(false);
          }).catch((error) => {
            this.log.warn(`(device/reboot) Unable to execute action: ${error}`);
          });
        } else if (idNoNamespace === "notification.dismiss") {
          this.apiClient.notifications.dismiss().then(async () => {
            this.log.info("dismissed notifications");
            await this.setState(idNoNamespace, { val: state.val, ack: true });
          }).catch((error) => {
            this.log.warn(`(notifications/active) Unable to execute action: ${error}`);
          });
        } else if (idNoNamespace === "apps.next") {
          this.log.debug("switching to next app");
          this.apiClient.apps.next().then(async () => {
            await this.setState(idNoNamespace, { val: state.val, ack: true });
          }).catch((error) => {
            this.log.warn(`(apps/next) Unable to execute action: ${error}`);
          });
        } else if (idNoNamespace === "apps.prev") {
          this.log.debug("switching to previous app");
          this.apiClient.apps.previous().then(async () => {
            await this.setState(idNoNamespace, { val: state.val, ack: true });
          }).catch((error) => {
            this.log.warn(`(apps/previous) Unable to execute action: ${error}`);
          });
        } else if (idNoNamespace.match(/indicator\.[0-9]{1}\..*$/g)) {
          const matches = idNoNamespace.match(/indicator\.([0-9]{1})\.(.*)$/);
          const indicatorNo = matches ? parseInt(matches[1]) : void 0;
          const action = matches ? matches[2] : void 0;
          this.log.debug(`Changed indicator ${indicatorNo} with action ${action}`);
          if (indicatorNo === 1 || indicatorNo === 2 || indicatorNo === 3) {
            this.updateIndicatorByStates(indicatorNo).then(async () => {
              await this.setState(idNoNamespace, { val: state.val, ack: true });
            }).catch((error) => {
              this.log.warn(`(indicator) Unable to perform action: ${error}`);
            });
          }
        }
      } else {
        this.log.warn(
          `Unable to perform action for ${idNoNamespace} - API is not connected (device not reachable?)`
        );
      }
    }
  }
  /* eslint-disable @typescript-eslint/no-unused-vars */
  async onObjectChange(id, obj) {
    if (!this.isMainInstance() && id && id == `system.adapter.${this.config.foreignSettingsInstance}`) {
      await this.importForeignSettings();
      this.restart();
    }
  }
  getWeatherOverlays() {
    return ["none", ...this.weatherOverlays];
  }
  getPalettes() {
    return ["none", ...this.palettes];
  }
  getPaletteEffects() {
    return ["none", ...this.paletteEffects];
  }
  onMessage(obj) {
    this.log.debug(`[onMessage] received command "${obj.command}" with message: ${JSON.stringify(obj.message)}`);
    if (obj && obj.message) {
      if (obj.command === "getBackgroundEffects") {
        this.sendTo(
          obj.from,
          obj.command,
          this.backgroundEffects.map((v) => ({ value: v, label: v })),
          obj.callback
        );
      } else if (obj.command === "notification" && typeof obj.message === "object") {
        if (this.apiClient && this.apiConnected) {
          const msgFiltered = Object.fromEntries(
            Object.entries(obj.message).filter(([_, v]) => v !== null)
          );
          if (msgFiltered.repeat !== void 0 && msgFiltered.repeat <= 0) {
            delete msgFiltered.repeat;
          }
          if (msgFiltered.durationMs !== void 0) {
            if (msgFiltered.durationMs <= 0) {
              delete msgFiltered.durationMs;
            } else if (msgFiltered.durationMs <= 500) {
              this.log.warn(
                `[onMessage <notification>] Very short duration detected: ${msgFiltered.durationMs} ms`
              );
            }
          }
          if (msgFiltered.icon && typeof msgFiltered.icon !== "string") {
            msgFiltered.icon = String(msgFiltered.icon);
          }
          this.apiClient.notifications.send(msgFiltered).then((data) => {
            this.sendTo(obj.from, obj.command, { error: null, data }, obj.callback);
          }).catch((error) => {
            this.sendTo(obj.from, obj.command, { error: this.errorToString(error) }, obj.callback);
          });
        } else {
          this.sendTo(
            obj.from,
            obj.command,
            { error: "API is not connected (device offline ?)" },
            obj.callback
          );
        }
      } else if (obj.command === "audio" && typeof obj.message === "object") {
        if (this.apiClient && this.apiConnected) {
          const msgFiltered = Object.fromEntries(
            Object.entries(obj.message).filter(([_, v]) => v !== null)
          );
          const keys = Object.keys(msgFiltered);
          if (keys.length > 1) {
            this.log.warn(
              `[onMessage <audio>] Received multiple keys for audio - just use one: ${JSON.stringify(keys)}`
            );
          }
          this.apiClient.audio.play(msgFiltered).then((data) => {
            this.sendTo(obj.from, obj.command, { error: null, data }, obj.callback);
          }).catch((error) => {
            this.sendTo(obj.from, obj.command, { error: this.errorToString(error) }, obj.callback);
          });
        } else {
          this.sendTo(
            obj.from,
            obj.command,
            { error: "API is not connected (device offline ?)" },
            obj.callback
          );
        }
      } else if (obj.command === "sendNotification" && typeof obj.message === "object") {
        if (this.apiClient && this.apiConnected) {
          const notification = obj.message;
          const { instances } = notification.category;
          const messages = Object.entries(instances).map(([, entry]) => entry.messages.map((m) => m.message)).join(", ");
          const notificationApp = {
            text: messages
          };
          this.apiClient.notifications.send(notificationApp).then(() => {
            this.sendTo(obj.from, obj.command, { error: null, sent: true }, obj.callback);
          }).catch((error) => {
            this.sendTo(
              obj.from,
              obj.command,
              { error: this.errorToString(error), sent: false },
              obj.callback
            );
          });
        } else {
          this.sendTo(
            obj.from,
            obj.command,
            { error: "API is not connected (device offline ?)", sent: false },
            obj.callback
          );
        }
      } else {
        this.log.error(`[onMessage] Received incomplete message via "sendTo"`);
        if (obj.callback) {
          this.sendTo(obj.from, obj.command, { error: "Incomplete message" }, obj.callback);
        }
      }
    } else if (obj.callback) {
      this.sendTo(obj.from, obj.command, { error: "Invalid message" }, obj.callback);
    }
  }
  async setApiConnected(connection) {
    if (connection !== this.apiConnected) {
      await this.setStateChangedAsync("info.connection", { val: connection, ack: true });
      this.apiConnected = connection;
      if (connection) {
        this.log.debug("API is online");
        await this.resyncDevice();
      } else {
        if (this.downloadScreenContentInterval) {
          this.clearInterval(this.downloadScreenContentInterval);
          this.downloadScreenContentInterval = void 0;
        }
        this.lastUptimeSeconds = void 0;
        this.log.debug("API is offline");
      }
    }
  }
  /**
   * Transfers everything the device should know (settings, apps, app order, indicators, ...).
   * Called when the device comes online and when a reboot was detected (pushed apps are held in RAM only).
   */
  async resyncDevice() {
    var _a;
    try {
      if (!this.welcomeSent) {
        this.apiClient.notifications.send({
          durationMs: 2e3,
          draw: [
            ["circle", 3, 4, 3, "#164477"],
            // ["circle", cx, cy, r, color]
            ["line", 3, 3, 3, 8, "#3399cc"],
            // ["line", x1, y1, x2, y2, color]
            ["pixel", 3, 1, "#3399cc"],
            // ["pixel", x, y, color]
            ["text", 10, 2, (_a = this.version) != null ? _a : "", "#164477"]
            // ["text", x, y, "HI", color]
          ]
        }).then(() => {
          this.welcomeSent = true;
        }).catch((error) => {
          this.log.warn(`(welcome notification) Unable to send: ${error}`);
        });
      }
      await this.refreshSettings();
      await this.refreshCapabilitiesLists();
      await this.createAppObjects();
      for (const i of [1, 2, 3]) {
        await this.updateIndicatorByStates(i);
      }
      await this.updateMoodlightByStates();
      if (this.config.downloadScreenContent) {
        if (!this.downloadScreenContentInterval) {
          this.log.debug(
            `[resyncDevice] Downloading screen contents every ${this.config.downloadScreenContentInterval} seconds`
          );
          const downloadInterval = Math.min(this.config.downloadScreenContentInterval, 86400) * 1e3;
          this.downloadScreenContentInterval = this.setInterval(() => {
            if (this.apiClient && this.apiConnected) {
              this.apiClient.display.getScreen().then(async (screen) => {
                var _a2;
                const { width, height, pixels } = screen;
                const pixelSize = 20;
                let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width * pixelSize}" height="${height * pixelSize}" viewBox="0 0 ${width * pixelSize} ${height * pixelSize}">`;
                for (let y = 0; y < height; y++) {
                  for (let x = 0; x < width; x++) {
                    const color = (0, import_awtrix_ng_api.toHexColor)((_a2 = pixels[y * width + x]) != null ? _a2 : 0);
                    svg += `
  <rect style="fill: ${color}; stroke: #000000; stroke-width: 2px;" `;
                    svg += `x="${x * pixelSize}" y="${y * pixelSize}" width="${pixelSize}" height="${pixelSize}"/>`;
                  }
                }
                svg += "\n</svg>";
                await this.setState("display.content", { val: svg, ack: true });
              }).catch((error) => {
                this.log.debug(`(display/screen) received error: ${error}`);
              });
            }
          }, downloadInterval);
        }
      } else {
        await this.setState("display.content", {
          val: `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="160"/>`,
          ack: true,
          c: "Feature disabled",
          q: 1
        });
      }
    } catch (error) {
      this.log.error(`[resyncDevice] Unable to refresh settings, apps or indicators: ${error}`);
    }
  }
  refreshState() {
    this.log.debug("refreshing device state");
    this.apiClient.device.get().then(async (content) => {
      var _a, _b, _c, _d;
      this.lastConnectionError = void 0;
      const rebootDetected = this.apiConnected && this.lastUptimeSeconds !== void 0 && content.uptimeSeconds < this.lastUptimeSeconds;
      this.lastUptimeSeconds = content.uptimeSeconds;
      if (rebootDetected) {
        this.log.info("Device was rebooted - transferring apps and settings again");
        await this.resyncDevice();
      } else {
        await this.setApiConnected(true);
      }
      this.currentVersion = String(content.version);
      if (this.currentVersion && this.isNewerVersion(this.currentVersion, this.supportedVersion) && !this.displayedVersionWarning) {
        this.log.warn(
          `You should update your Awtrix NG - supported version of this adapter is ${this.supportedVersion} (or later). Your current version is ${this.currentVersion}`
        );
        this.displayedVersionWarning = true;
      }
      await this.setStateChangedAsync("meta.uid", { val: content.uid, ack: true });
      await this.setStateChangedAsync("meta.version", { val: content.version, ack: true });
      await this.setStateChangedAsync("meta.boardType", { val: content.boardType, ack: true });
      await this.setStateChangedAsync("meta.soc", { val: content.soc, ack: true });
      await this.setStateChangedAsync("sensor.lux", { val: (_a = content.lightLevel) != null ? _a : null, ack: true });
      await this.setStateChangedAsync("sensor.temp", { val: (_b = content.temperature) != null ? _b : null, ack: true });
      await this.setStateChangedAsync("sensor.humidity", { val: (_c = content.humidity) != null ? _c : null, ack: true });
      await this.setStateChangedAsync("display.brightness", { val: content.brightness, ack: true });
      await this.setStateChangedAsync("device.battery", { val: (_d = content.batteryPercent) != null ? _d : null, ack: true });
      await this.setStateChangedAsync("device.ipAddress", { val: content.ipAddress, ack: true });
      await this.setStateChangedAsync("device.wifiSignal", { val: content.wifiRssi, ack: true });
      await this.setStateChangedAsync("device.freeRAM", { val: content.freeHeapBytes, ack: true });
      await this.setStateChangedAsync("device.uptime", { val: content.uptimeSeconds, ack: true });
    }).catch((error) => {
      this.currentVersion = void 0;
      this.logRequestError(error);
      this.log.debug(`(stats) received error - API is now offline: ${error}`);
      this.setApiConnected(false).catch((error2) => {
        this.log.warn(`[refreshState] Set API connected to false failed`);
      });
    });
    this.log.debug("re-creating refresh state timeout");
    this.refreshStateTimeout = this.refreshStateTimeout || this.setTimeout(() => {
      this.refreshStateTimeout = void 0;
      this.refreshState();
    }, 60 * 1e3);
  }
  flattenObject(obj, prefix = "") {
    return Object.keys(obj).reduce((acc, key) => {
      const newPath = prefix ? `${prefix}.${key}` : key;
      const value = obj[key];
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        Object.assign(acc, this.flattenObject(value, newPath));
      } else {
        acc[newPath] = value;
      }
      return acc;
    }, {});
  }
  async refreshSettings() {
    var _a, _b;
    try {
      const content = this.flattenObject(await this.apiClient.settings.get());
      const settingsStates = await this.getObjectViewAsync("system", "state", {
        startkey: `${this.namespace}.settings.`,
        endkey: `${this.namespace}.settings.\u9999`
      });
      const knownSettings = {};
      for (const settingsObj of settingsStates.rows) {
        if ((_b = (_a = settingsObj.value) == null ? void 0 : _a.native) == null ? void 0 : _b.settingsKey) {
          knownSettings[settingsObj.value.native.settingsKey] = {
            id: this.removeNamespace(settingsObj.id),
            role: settingsObj.value.common.role
          };
        }
      }
      const unknownSettings = [];
      for (const [settingsKey, val] of Object.entries(content)) {
        if (Object.prototype.hasOwnProperty.call(knownSettings, settingsKey)) {
          this.log.debug(
            `[refreshSettings] updating settings value "${knownSettings[settingsKey].id}" to ${String(val)}`
          );
          await this.setStateChangedAsync(knownSettings[settingsKey].id, {
            val,
            ack: true,
            c: "Updated from API"
          });
        } else {
          unknownSettings.push(settingsKey);
        }
      }
      this.log.debug(`[refreshSettings] Missing setting objects for keys: ${JSON.stringify(unknownSettings)}`);
    } catch (error) {
      this.log.warn(`(settings) Received error: ${error}`);
      throw error;
    }
  }
  async refreshCapabilitiesLists() {
    const capabilities = await this.apiClient.device.capabilities();
    this.log.debug(`[refreshCapabilitiesLists] Existing capabilities "${JSON.stringify(capabilities)}"`);
    this.backgroundEffects = capabilities.effects;
    this.weatherOverlays = capabilities.overlays;
    const states = {};
    for (const transition of capabilities.transitions) {
      states[transition] = transition;
    }
    await this.extendObject("settings.apps.transitionEffect", { common: { states } });
  }
  findAppWithName(name) {
    return this.apps.find((app) => app.getName() === name);
  }
  async createAppObjects() {
    if (!this.apiClient || !this.apiConnected) {
      throw new Error("API_OFFLINE");
    }
    const apiClient = this.apiClient;
    let content;
    try {
      content = await apiClient.apps.list();
    } catch (error) {
      this.log.debug(`[createAppObjects] received error: ${error}`);
      throw error;
    }
    const builtinApps = content.filter((a) => a.origin === "builtin").map((a) => a.name);
    const scriptApps = content.filter((a) => a.origin === "script").map((a) => a.name);
    for (const builtinAppName of builtinApps) {
      if (!this.findAppWithName(builtinAppName)) {
        this.apps.push(new import_builtin.AppType.Builtin(apiClient, this, builtinAppName));
      }
    }
    for (const scriptAppName of scriptApps) {
      if (!this.findAppWithName(scriptAppName)) {
        this.apps.push(new import_script.AppType.Script(apiClient, this, scriptAppName));
      }
    }
    for (const customApp of this.config.customApps) {
      if (!this.findAppWithName(customApp.name)) {
        this.apps.push(new import_custom.AppType.Custom(apiClient, this, customApp));
      } else {
        this.log.warn(`App with name ${customApp.name} already exists. Skipping custom app!`);
      }
    }
    for (const historyApp of this.config.historyApps) {
      if (!this.findAppWithName(historyApp.name)) {
        this.apps.push(new import_history.AppType.History(apiClient, this, historyApp));
      } else {
        this.log.warn(`App with name ${historyApp.name} already exists. Skipping history app!`);
      }
    }
    for (const expertApp of this.config.expertApps) {
      if (!this.findAppWithName(expertApp.name)) {
        this.apps.push(new import_expert.AppType.Expert(apiClient, this, expertApp));
      } else {
        this.log.warn(`App with name ${expertApp.name} already exists. Skipping expert app!`);
      }
    }
    const customApps = this.config.customApps.map((a) => a.name);
    const historyApps = this.config.historyApps.map((a) => a.name);
    const expertApps = this.config.expertApps.map((a) => a.name);
    const allApps = [...builtinApps, ...scriptApps, ...customApps, ...historyApps, ...expertApps];
    const appsAll = [];
    const appsKeep = [];
    const existingChannels = await this.getChannelsOfAsync("apps");
    if (existingChannels) {
      for (const existingChannel of existingChannels) {
        const id = this.removeNamespace(existingChannel._id);
        if (id.split(".").length === 2) {
          appsAll.push(id);
        }
      }
    }
    for (const name of allApps) {
      const isBuiltinApp = builtinApps.includes(name);
      const isScriptApp = scriptApps.includes(name);
      const isCustomApp = customApps.includes(name);
      const isHistoryApp = historyApps.includes(name);
      const isExpertApp = expertApps.includes(name);
      const app = this.findAppWithName(name);
      if (app) {
        this.log.debug(`[createAppObjects] found (keep): apps.${app.getNameClean()}`);
        appsKeep.push(`apps.${app.getNameClean()}`);
        await this.extendObject(`apps.${app.getNameClean()}`, {
          type: "channel",
          common: {
            name: `App ${name}`,
            desc: `${app.getDescription()} app`,
            icon: app.getIconForObjectTree()
          },
          native: {
            isBuiltinApp,
            isScriptApp,
            isCustomApp,
            isHistoryApp,
            isExpertApp
          }
        });
        const appInfo = content.find((a) => a.name === app.getName());
        await app.createObjects();
        await app.init(appInfo);
        await app.refresh();
      }
    }
    for (const app of appsAll) {
      if (!appsKeep.includes(app)) {
        await this.delObjectAsync(app, { recursive: true });
        this.log.debug(`[createAppObjects] deleted: ${app}`);
      }
    }
    await this.refreshAppOrder();
    return appsKeep.length;
  }
  async refreshAppOrder() {
    if (this.apiClient && this.apiConnected) {
      try {
        const appsEnabled = this.apps.filter((a) => a.enabled());
        appsEnabled.sort((a, b) => {
          var _a, _b;
          return ((_a = a.getSlot()) != null ? _a : 9999) - ((_b = b.getSlot()) != null ? _b : 9999);
        });
        await this.apiClient.apps.setOrder({
          order: appsEnabled.map((a) => a.getName()),
          disabled: this.apps.filter((a) => !a.enabled()).map((a) => a.getName())
        });
      } catch (err) {
        this.log.error(`[refreshAppOrder] Failed to change app order: ${err}`);
      }
    }
  }
  async updateIndicatorByStates(index) {
    this.log.debug(`Updating indicator with index ${index}`);
    const indicatorStates = await this.getStatesAsync(`indicator.${index}.*`);
    const indicatorValues = Object.entries(indicatorStates).reduce(
      (acc, [objId, state]) => ({
        ...acc,
        [this.removeNamespace(objId)]: state.val
      }),
      {}
    );
    if (indicatorValues[`indicator.${index}.active`]) {
      const indicator = {
        color: indicatorValues[`indicator.${index}.color`]
      };
      if (indicator.color !== "0") {
        const blink = indicatorValues[`indicator.${index}.blink`];
        if (blink > 0) {
          indicator.blinkMs = blink;
        } else {
          const fade = indicatorValues[`indicator.${index}.fade`];
          indicator.fadeMs = fade;
        }
      }
      return this.apiClient.indicators.set(index, indicator);
    }
    return this.apiClient.indicators.clear(index);
  }
  async updateMoodlightByStates() {
    this.log.debug(`Updating moodlight`);
    const moodlightStates = await this.getStatesAsync("display.moodlight.*");
    const moodlightValues = Object.entries(moodlightStates).reduce(
      (acc, [objId, state]) => ({
        ...acc,
        [this.removeNamespace(objId)]: state.val
      }),
      {}
    );
    if (moodlightValues["display.moodlight.active"]) {
      const moodlight = {
        brightness: moodlightValues["display.moodlight.brightness"],
        color: String(moodlightValues["display.moodlight.color"]).toUpperCase()
      };
      return this.apiClient.display.setMoodlight(moodlight);
    }
    return this.apiClient.display.disableMoodlight();
  }
  errorToString(error) {
    return error instanceof Error ? error.message : String(error);
  }
  logRequestError(error) {
    var _a;
    if (error instanceof import_awtrix_ng_api.AwtrixApiError) {
      if (error.isUnauthorized) {
        this.log.warn(
          "Unable to perform request. Looks like the device is protected with username / password. Check instance configuration!"
        );
      } else {
        this.log.warn(`received error response: ${error.message}`);
      }
    } else if (error instanceof import_awtrix_ng_api.AwtrixConnectionError) {
      const connectionError = (_a = error.code) != null ? _a : error.kind;
      if (connectionError === this.lastConnectionError) {
        this.log.debug(error.message);
      } else {
        this.log.info(`error ${connectionError}: ${error.message}`);
        this.lastConnectionError = connectionError;
      }
    } else {
      this.log.error(this.errorToString(error));
    }
  }
  removeNamespace(id) {
    const re = new RegExp(`${this.namespace}*\\.`, "g");
    return id.replace(re, "");
  }
  async onUnload(callback) {
    try {
      for (const app of this.apps) {
        if (app instanceof import_user.AppType.UserApp) {
          await app.unloadAsync();
        }
      }
      await this.setApiConnected(false);
      if (this.refreshStateTimeout) {
        this.log.debug("clearing refresh state timeout");
        this.clearTimeout(this.refreshStateTimeout);
      }
      if (this.downloadScreenContentInterval) {
        this.clearInterval(this.downloadScreenContentInterval);
        this.downloadScreenContentInterval = void 0;
      }
      callback();
    } catch (e) {
      callback();
    }
  }
  isNewerVersion(oldVer, newVer) {
    const oldParts = oldVer.replace("-dev", "").split(".");
    const newParts = newVer.replace("-dev", "").split(".");
    for (let i = 0; i < newParts.length; i++) {
      const a = ~~newParts[i];
      const b = ~~oldParts[i];
      if (a > b) {
        return true;
      }
      if (a < b) {
        return false;
      }
    }
    return false;
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AwtrixNg
});
//# sourceMappingURL=awtrix-ng.js.map
