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
var import_melody = require("./lib/audio/melody");
var import_mp3 = require("./lib/audio/mp3");
var import_radio = require("./lib/audio/radio");
var import_screen = require("./lib/screen");
var import_builtin = require("./lib/app-type/builtin");
var import_script = require("./lib/app-type/script");
var import_custom = require("./lib/app-type/user/custom");
var import_expert = require("./lib/app-type/user/expert");
var import_history = require("./lib/app-type/user/history");
const DEFAULT_CAPABILITIES = {
  loaded: false,
  effects: [
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
  ],
  overlays: ["rain", "snow", "drizzle", "storm", "thunder", "frost"],
  palettes: ["Cloud", "Lava", "Ocean", "Forest", "Stripe", "Party", "Heat", "Rainbow"],
  paletteEffects: [
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
  ],
  transitions: [],
  radio: false,
  mp3: false,
  melody: false
};
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
  resyncFailedSteps;
  appOrderLock;
  appOrderSyncTimeout;
  radio;
  mp3;
  melody;
  capabilities;
  refreshStateTimeout;
  downloadScreenContentInterval;
  apps;
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
    this.resyncFailedSteps = /* @__PURE__ */ new Set();
    this.appOrderLock = Promise.resolve();
    this.appOrderSyncTimeout = void 0;
    this.radio = null;
    this.mp3 = null;
    this.melody = null;
    this.capabilities = { ...DEFAULT_CAPABILITIES };
    this.refreshStateTimeout = void 0;
    this.downloadScreenContentInterval = void 0;
    this.apps = [];
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
    this.radio = new import_radio.Radio(this, this.apiClient);
    this.mp3 = new import_mp3.Mp3(this, this.apiClient);
    this.melody = new import_melody.Melody(this, this.apiClient);
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
  isApiConnected() {
    return this.apiConnected;
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
        } else if (idNoNamespace.startsWith("audio.radio.")) {
          this.radio.onStateChange(idNoNamespace, state).catch((error) => {
            this.log.warn(`(radio) Unable to execute action: ${error}`);
          });
        } else if (idNoNamespace.startsWith("audio.mp3.")) {
          this.mp3.onStateChange(idNoNamespace, state).catch((error) => {
            this.log.warn(`(mp3) Unable to execute action: ${error}`);
          });
        } else if (idNoNamespace.startsWith("audio.melody.")) {
          this.melody.onStateChange(idNoNamespace, state).catch((error) => {
            this.log.warn(`(melody) Unable to execute action: ${error}`);
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
    return ["none", ...this.capabilities.overlays];
  }
  getPalettes() {
    return ["none", ...this.capabilities.palettes];
  }
  getPaletteEffects() {
    return ["none", ...this.capabilities.paletteEffects];
  }
  onMessage(obj) {
    this.log.debug(`[onMessage] received command "${obj.command}" with message: ${JSON.stringify(obj.message)}`);
    if (obj && obj.message) {
      if (obj.command === "getBackgroundEffects") {
        this.sendTo(
          obj.from,
          obj.command,
          this.capabilities.effects.map((v) => ({ value: v, label: v })),
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
        this.resyncFailedSteps.clear();
        this.log.debug("API is offline");
      }
    }
  }
  /**
   * Transfers everything the device should know (settings, apps, app order, indicators, ...).
   * Called when the device comes online and when a reboot was detected (pushed apps are held in RAM only).
   * Each step is executed on its own - failed steps are retried with the next state refresh.
   *
   * @param onlySteps - just execute these steps (retry of failed steps)
   */
  async resyncDevice(onlySteps) {
    if (!onlySteps) {
      this.sendWelcomeNotification();
    }
    const steps = [
      ["settings", () => this.refreshSettings()],
      ["capabilities", () => this.refreshCapabilities()],
      ["audio", () => this.refreshAudio(true)],
      ["apps", () => this.createAppObjects()],
      ["indicators", () => this.updateAllIndicatorsByStates()],
      ["moodlight", () => this.updateMoodlightByStates()],
      ["screenContent", () => this.initScreenContentDownload()]
    ];
    const failedSteps = /* @__PURE__ */ new Set();
    for (const [step, fn] of steps) {
      if (onlySteps && !onlySteps.has(step)) {
        continue;
      }
      try {
        await fn();
      } catch (error) {
        failedSteps.add(step);
        this.log.debug(`[resyncDevice] Step "${step}" failed: ${error}`);
        if (!this.apiConnected) {
          break;
        }
      }
    }
    if (failedSteps.size > 0) {
      const msg = `[resyncDevice] Unable to transfer ${[...failedSteps].join(", ")} - retrying with next refresh`;
      if (this.resyncFailedSteps.size === 0) {
        this.log.warn(msg);
      } else {
        this.log.debug(msg);
      }
    } else if (this.resyncFailedSteps.size > 0) {
      this.log.info("[resyncDevice] Transferred all remaining data successfully");
    }
    this.resyncFailedSteps = failedSteps;
  }
  sendWelcomeNotification() {
    var _a;
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
  }
  async initScreenContentDownload() {
    if (this.config.downloadScreenContent) {
      if (!this.downloadScreenContentInterval) {
        this.log.debug(
          `[initScreenContentDownload] Downloading screen contents every ${this.config.downloadScreenContentInterval} seconds`
        );
        const downloadInterval = Math.min(Math.max(this.config.downloadScreenContentInterval, 5), 86400) * 1e3;
        this.downloadScreenContentInterval = this.setInterval(() => {
          if (this.apiClient && this.apiConnected) {
            this.apiClient.display.getScreen().then(async (screen) => {
              await this.setStateChangedAsync("display.content", {
                val: (0, import_screen.screenToSvg)(screen),
                ack: true
              });
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
      } else if (this.apiConnected && this.resyncFailedSteps.size > 0) {
        await this.resyncDevice(new Set(this.resyncFailedSteps));
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
      if (this.capabilities.loaded && !this.resyncFailedSteps.has("audio")) {
        await this.refreshAudio(false).catch((error) => {
          this.log.debug(`[refreshState] Unable to refresh audio: ${error}`);
        });
      }
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
      this.log.debug(`(settings) Received error: ${error}`);
      throw error;
    }
  }
  async refreshCapabilities() {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const capabilities = await this.apiClient.device.capabilities();
    this.log.debug(`[refreshCapabilities] Existing capabilities "${JSON.stringify(capabilities)}"`);
    this.capabilities = {
      loaded: true,
      effects: (_a = capabilities.effects) != null ? _a : DEFAULT_CAPABILITIES.effects,
      overlays: (_b = capabilities.overlays) != null ? _b : DEFAULT_CAPABILITIES.overlays,
      palettes: (_c = capabilities.palettes) != null ? _c : DEFAULT_CAPABILITIES.palettes,
      paletteEffects: (_d = capabilities.paletteEffects) != null ? _d : DEFAULT_CAPABILITIES.paletteEffects,
      transitions: (_e = capabilities.transitions) != null ? _e : DEFAULT_CAPABILITIES.transitions,
      radio: ((_f = capabilities.audio) == null ? void 0 : _f.radio) === true,
      mp3: ((_g = capabilities.audio) == null ? void 0 : _g.mp3) === true,
      melody: ((_h = capabilities.audio) == null ? void 0 : _h.buzzer) === true
    };
    const states = {};
    for (const transition of this.capabilities.transitions) {
      states[transition] = transition;
    }
    await this.extendObject("settings.apps.transitionEffect", { common: { states } });
  }
  /**
   * Radio stations, mp3 files, melodies and playback state (just if supported by the device).
   * Objects of unsupported features are deleted.
   *
   * @param forceObjectSync - create / check objects even if the lists are unchanged
   */
  async refreshAudio(forceObjectSync) {
    if (!this.capabilities.loaded) {
      throw new Error("capabilities of device unknown");
    }
    const players = [
      [this.radio, this.capabilities.radio],
      [this.mp3, this.capabilities.mp3],
      [this.melody, this.capabilities.melody]
    ];
    const audioState = players.some(([, supported]) => supported) ? await this.apiClient.audio.getState() : void 0;
    const errors = [];
    for (const [player, supported] of players) {
      try {
        if (supported) {
          await player.refresh(forceObjectSync, audioState);
        } else {
          await player.remove();
        }
      } catch (error) {
        errors.push(this.errorToString(error));
      }
    }
    if (errors.length > 0) {
      throw new Error(errors.join(", "));
    }
  }
  isValidUserAppName(name) {
    const reservedNames = [
      // builtin apps
      "time",
      "date",
      "temperature",
      "humidity",
      "battery",
      "status",
      // reserved by the device (routes)
      "active",
      "next",
      "previous",
      "order",
      // would collide with the state apps.prev
      "prev"
    ];
    return (0, import_awtrix_ng_api.isValidAppName)(name) && !reservedNames.includes(name.toLowerCase());
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
    for (const app of [...this.apps]) {
      const vanished = app instanceof import_builtin.AppType.Builtin && !builtinApps.includes(app.getName()) || app instanceof import_script.AppType.Script && !scriptApps.includes(app.getName());
      if (vanished) {
        this.log.debug(`[createAppObjects] app "${app.getName()}" is not present on the device anymore`);
        await app.unloadAsync(false);
        this.apps.splice(this.apps.indexOf(app), 1);
      }
    }
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
      if (!this.isValidUserAppName(customApp.name)) {
        this.log.warn(
          `App name "${customApp.name}" is invalid or reserved (allowed: A-Z, a-z, 0-9, _ and -, max. 32 characters). Skipping custom app!`
        );
      } else if (!this.findAppWithName(customApp.name)) {
        this.apps.push(new import_custom.AppType.Custom(apiClient, this, customApp));
      } else {
        this.log.warn(`App with name ${customApp.name} already exists. Skipping custom app!`);
      }
    }
    for (const historyApp of this.config.historyApps) {
      if (!this.isValidUserAppName(historyApp.name)) {
        this.log.warn(
          `App name "${historyApp.name}" is invalid or reserved (allowed: A-Z, a-z, 0-9, _ and -, max. 32 characters). Skipping history app!`
        );
      } else if (!this.findAppWithName(historyApp.name)) {
        this.apps.push(new import_history.AppType.History(apiClient, this, historyApp));
      } else {
        this.log.warn(`App with name ${historyApp.name} already exists. Skipping history app!`);
      }
    }
    for (const expertApp of this.config.expertApps) {
      if (!this.isValidUserAppName(expertApp.name)) {
        this.log.warn(
          `App name "${expertApp.name}" is invalid or reserved (allowed: A-Z, a-z, 0-9, _ and -, max. 32 characters). Skipping expert app!`
        );
      } else if (!this.findAppWithName(expertApp.name)) {
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
    const failedApps = [];
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
        try {
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
        } catch (error) {
          failedApps.push(name);
          this.log.warn(`[createAppObjects] Unable to initialize app "${name}": ${error}`);
        }
      }
    }
    for (const app of appsAll) {
      if (!appsKeep.includes(app)) {
        await this.delObjectAsync(app, { recursive: true });
        this.log.debug(`[createAppObjects] deleted: ${app}`);
      }
    }
    await this.runAppOrderExclusive(() => this.normalizeAppOrder());
    await this.sendAppOrder();
    if (failedApps.length > 0) {
      throw new Error(`Unable to initialize apps: ${failedApps.join(", ")}`);
    }
    return appsKeep.length;
  }
  async refreshAppOrder() {
    if (this.apiClient && this.apiConnected) {
      try {
        await this.sendAppOrder();
      } catch (err) {
        this.log.error(`[refreshAppOrder] Failed to change app order: ${err}`);
      }
    }
  }
  /**
   * Operations on the app order are executed one after another (e.g. multiple slot changes at once)
   *
   * @param fn - operation
   */
  async runAppOrderExclusive(fn) {
    const result = this.appOrderLock.then(fn);
    this.appOrderLock = result.catch(() => void 0);
    return result;
  }
  /**
   * All apps sorted by their current position (apps without position at the end)
   */
  getAppsSortedBySlot() {
    return [...this.apps].sort(
      (a, b) => {
        var _a, _b;
        return ((_a = a.getSlot()) != null ? _a : Number.MAX_SAFE_INTEGER) - ((_b = b.getSlot()) != null ? _b : Number.MAX_SAFE_INTEGER) || a.getName().localeCompare(b.getName());
      }
    );
  }
  /**
   * Brings the positions of all apps into a dense order (0 ... n-1). Apps without a position
   * (new apps or first start) are appended - sorted by their position on the device.
   */
  async normalizeAppOrder() {
    const appsWithSlot = this.apps.filter((a) => a.getSlot() !== null);
    const appsWithoutSlot = this.apps.filter((a) => a.getSlot() === null).sort(
      (a, b) => {
        var _a, _b;
        return ((_a = a.getDeviceSlot()) != null ? _a : Number.MAX_SAFE_INTEGER) - ((_b = b.getDeviceSlot()) != null ? _b : Number.MAX_SAFE_INTEGER) || a.getName().localeCompare(b.getName());
      }
    );
    const sorted = [
      ...appsWithSlot.sort((a, b) => a.getSlot() - b.getSlot() || a.getName().localeCompare(b.getName())),
      ...appsWithoutSlot
    ];
    await this.applyAppSlots(sorted);
  }
  /**
   * Sets the position of each app to its index in the given list and updates the slot states
   *
   * @param sorted - all apps in the new order
   * @param movedApp - app which has been moved by the user (state is acknowledged even if unchanged)
   */
  async applyAppSlots(sorted, movedApp) {
    for (const [index, app] of sorted.entries()) {
      const changed = app.getSlot() !== index;
      app.setSlot(index);
      if (changed || app === movedApp) {
        await this.setState(`apps.${app.getNameClean()}.slot`, { val: index, ack: true, c: "app order" });
      } else {
        await this.setStateChangedAsync(`apps.${app.getNameClean()}.slot`, { val: index, ack: true });
      }
    }
  }
  /**
   * Moves the app to the given position - all other apps are shifted (main instance only)
   *
   * @param app - app to move
   * @param position - new position (0 = first)
   */
  async moveApp(app, position) {
    await this.runAppOrderExclusive(async () => {
      const sorted = this.getAppsSortedBySlot().filter((a) => a !== app);
      const index = Math.max(0, Math.min(Math.round(position), sorted.length));
      sorted.splice(index, 0, app);
      await this.applyAppSlots(sorted, app);
    });
    await this.refreshAppOrder();
  }
  /**
   * Follow the order of the main instance (other instances only) - debounced, because a move
   * in the main instance changes the slots of multiple apps
   */
  scheduleAppOrderSync() {
    if (this.appOrderSyncTimeout) {
      this.clearTimeout(this.appOrderSyncTimeout);
    }
    this.appOrderSyncTimeout = this.setTimeout(async () => {
      this.appOrderSyncTimeout = void 0;
      try {
        await this.runAppOrderExclusive(async () => {
          for (const app of this.apps) {
            const slotState = await this.getForeignStateAsync(
              `${this.config.foreignSettingsInstance}.apps.${app.getNameClean()}.slot`
            );
            app.setSlot(slotState && typeof slotState.val === "number" ? slotState.val : null);
          }
          await this.normalizeAppOrder();
        });
        await this.refreshAppOrder();
      } catch (error) {
        this.log.warn(`[scheduleAppOrderSync] Unable to apply app order of main instance: ${error}`);
      }
    }, 500);
  }
  async sendAppOrder() {
    const appsEnabled = this.getAppsSortedBySlot().filter((a) => a.enabled());
    await this.apiClient.apps.setOrder({
      order: appsEnabled.map((a) => a.getName()),
      disabled: this.apps.filter((a) => !a.enabled()).map((a) => a.getName())
    });
  }
  async updateAllIndicatorsByStates() {
    const errors = [];
    for (const i of [1, 2, 3]) {
      try {
        await this.updateIndicatorByStates(i);
      } catch (error) {
        errors.push(`indicator ${i}: ${this.errorToString(error)}`);
      }
    }
    if (errors.length > 0) {
      throw new Error(errors.join(", "));
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
    var _a, _b, _c;
    try {
      const removeFromDevice = this.apiConnected;
      if (!removeFromDevice && this.config.removeAppsOnStop) {
        this.log.info("[onUnload] Device is not reachable - unable to remove apps");
      }
      await Promise.allSettled(this.apps.map((app) => app.unloadAsync(removeFromDevice)));
      this.apps = [];
      await this.setApiConnected(false);
      if (this.refreshStateTimeout) {
        this.log.debug("clearing refresh state timeout");
        this.clearTimeout(this.refreshStateTimeout);
      }
      if (this.downloadScreenContentInterval) {
        this.clearInterval(this.downloadScreenContentInterval);
        this.downloadScreenContentInterval = void 0;
      }
      if (this.appOrderSyncTimeout) {
        this.clearTimeout(this.appOrderSyncTimeout);
        this.appOrderSyncTimeout = void 0;
      }
      (_a = this.radio) == null ? void 0 : _a.unload();
      (_b = this.mp3) == null ? void 0 : _b.unload();
      (_c = this.melody) == null ? void 0 : _c.unload();
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
