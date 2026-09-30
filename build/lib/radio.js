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
var radio_exports = {};
__export(radio_exports, {
  Radio: () => Radio
});
module.exports = __toCommonJS(radio_exports);
class Radio {
  static CHANNEL = "audio.radio";
  /** Names of the global states in audio.radio - stations with the same (clean) name are skipped */
  static RESERVED_NAMES = ["playing", "station", "title", "stop"];
  adapter;
  apiClient;
  /** clean name (object id) -> station name */
  stations;
  stationsHash;
  lastState;
  refreshTimeout;
  constructor(adapter, apiClient) {
    this.adapter = adapter;
    this.apiClient = apiClient;
    this.stations = /* @__PURE__ */ new Map();
    this.stationsHash = void 0;
    this.lastState = void 0;
    this.refreshTimeout = void 0;
  }
  /**
   * Reads stations and playback state of the device - creates / deletes station objects if the list has changed
   *
   * @param forceObjectSync - create / check objects even if the station list is unchanged
   */
  async refresh(forceObjectSync) {
    const audioState = await this.apiClient.audio.getState();
    const stationsHash = JSON.stringify(audioState.stations);
    if (forceObjectSync || stationsHash !== this.stationsHash) {
      await this.syncStationObjects(audioState);
      this.stationsHash = stationsHash;
    }
    await this.updatePlaybackStates(audioState);
  }
  /**
   * Removes all radio objects (e.g. device does not support radio)
   */
  async remove() {
    this.stations.clear();
    this.stationsHash = void 0;
    this.lastState = void 0;
    const channelObj = await this.adapter.getObjectAsync(Radio.CHANNEL);
    if (channelObj) {
      this.adapter.log.debug(`[radio] Device does not support radio - deleting objects`);
      await this.adapter.delObjectAsync(Radio.CHANNEL, { recursive: true });
    }
  }
  unload() {
    if (this.refreshTimeout) {
      this.adapter.clearTimeout(this.refreshTimeout);
      this.refreshTimeout = void 0;
    }
  }
  /**
   * Handles write actions of the user
   *
   * @param idNoNamespace - state id without namespace
   * @param state - new state (ack: false)
   */
  async onStateChange(idNoNamespace, state) {
    if (idNoNamespace === `${Radio.CHANNEL}.stop`) {
      await this.apiClient.audio.stop("stream");
      this.adapter.log.debug("[radio] Stopped radio");
      await this.adapter.setState(idNoNamespace, { val: state.val, ack: true });
      await this.setPlayingStation(null);
      this.scheduleRefresh();
      return;
    }
    const matches = idNoNamespace.match(/^audio\.radio\.([^.]+)\.playing$/);
    const stationName = matches ? this.stations.get(matches[1]) : void 0;
    if (!stationName) {
      this.adapter.log.warn(`[radio] Unknown station for state ${idNoNamespace}`);
      return;
    }
    if (state.val) {
      await this.apiClient.audio.playStation(stationName);
      this.adapter.log.debug(`[radio] Playing station "${stationName}"`);
      await this.setPlayingStation(stationName);
    } else if (this.getPlayingStation() === stationName) {
      await this.apiClient.audio.stop("stream");
      this.adapter.log.debug(`[radio] Stopped station "${stationName}"`);
      await this.setPlayingStation(null);
    } else {
      await this.adapter.setState(idNoNamespace, { val: false, ack: true });
    }
    this.scheduleRefresh();
  }
  getPlayingStation() {
    var _a;
    return ((_a = this.lastState) == null ? void 0 : _a.radio.playing) ? this.lastState.radio.station : null;
  }
  /**
   * Sets the playing states of all stations (optimistic - until the next refresh)
   *
   * @param stationName - playing station (null = stopped)
   */
  async setPlayingStation(stationName) {
    if (this.lastState) {
      this.lastState.radio.playing = stationName !== null;
      this.lastState.radio.station = stationName != null ? stationName : "";
    }
    for (const [nameClean, name] of this.stations) {
      await this.adapter.setState(`${Radio.CHANNEL}.${nameClean}.playing`, {
        val: name === stationName,
        ack: true
      });
    }
    await this.adapter.setStateChangedAsync(`${Radio.CHANNEL}.playing`, { val: stationName !== null, ack: true });
    await this.adapter.setStateChangedAsync(`${Radio.CHANNEL}.station`, { val: stationName != null ? stationName : "", ack: true });
  }
  scheduleRefresh() {
    this.unload();
    this.refreshTimeout = this.adapter.setTimeout(async () => {
      this.refreshTimeout = void 0;
      if (this.adapter.isApiConnected()) {
        await this.refresh(false).catch((error) => {
          this.adapter.log.debug(`[radio] Unable to refresh state: ${error}`);
        });
      }
    }, 5e3);
  }
  async updatePlaybackStates(audioState) {
    this.lastState = audioState;
    const { playing, station, title } = audioState.radio;
    await this.adapter.setStateChangedAsync(`${Radio.CHANNEL}.playing`, { val: playing, ack: true });
    await this.adapter.setStateChangedAsync(`${Radio.CHANNEL}.station`, {
      val: playing ? station : "",
      ack: true
    });
    await this.adapter.setStateChangedAsync(`${Radio.CHANNEL}.title`, { val: playing ? title : "", ack: true });
    for (const [nameClean, name] of this.stations) {
      await this.adapter.setStateChangedAsync(`${Radio.CHANNEL}.${nameClean}.playing`, {
        val: playing && station === name,
        ack: true
      });
    }
  }
  cleanName(name) {
    return name.replace(this.adapter.FORBIDDEN_CHARS, "_").replace(/[.\s/]+/g, "_").replace(/_{2,}/g, "_").replace(/^_+|_+$/g, "");
  }
  async syncStationObjects(audioState) {
    await this.createBaseObjects();
    this.stations.clear();
    for (const station of audioState.stations) {
      const nameClean = this.cleanName(station.name);
      if (!nameClean || Radio.RESERVED_NAMES.includes(nameClean)) {
        this.adapter.log.warn(`[radio] Station name "${station.name}" is reserved or invalid - skipping`);
        continue;
      }
      if (this.stations.has(nameClean)) {
        this.adapter.log.warn(
          `[radio] Station "${station.name}" has the same object id as "${this.stations.get(nameClean)}" - skipping`
        );
        continue;
      }
      this.stations.set(nameClean, station.name);
      await this.adapter.extendObject(`${Radio.CHANNEL}.${nameClean}`, {
        type: "channel",
        common: {
          name: station.name
        },
        native: {
          station: station.name
        }
      });
      await this.adapter.extendObject(`${Radio.CHANNEL}.${nameClean}.playing`, {
        type: "state",
        common: {
          name: {
            en: "Play",
            de: "Abspielen",
            ru: "\u0412\u043E\u0441\u043F\u0440\u043E\u0438\u0437\u0432\u0435\u0441\u0442\u0438",
            pt: "Reproduzir",
            nl: "Afspelen",
            fr: "Lecture",
            it: "Riproduci",
            es: "Reproducir",
            pl: "Odtw\xF3rz",
            uk: "\u0412\u0456\u0434\u0442\u0432\u043E\u0440\u0438\u0442\u0438",
            "zh-cn": "\u64AD\u653E"
          },
          desc: "true = play, false = stop",
          type: "boolean",
          role: "switch",
          read: true,
          write: true,
          def: false
        },
        native: {}
      });
      await this.adapter.extendObject(`${Radio.CHANNEL}.${nameClean}.url`, {
        type: "state",
        common: {
          name: {
            en: "Stream URL",
            de: "Stream-URL",
            ru: "URL \u043F\u043E\u0442\u043E\u043A\u0430",
            pt: "URL do stream",
            nl: "Stream-URL",
            fr: "URL du flux",
            it: "URL dello stream",
            es: "URL del stream",
            pl: "Adres URL strumienia",
            uk: "URL \u043F\u043E\u0442\u043E\u043A\u0443",
            "zh-cn": "\u6D41\u5730\u5740"
          },
          type: "string",
          role: "text.url",
          read: true,
          write: false
        },
        native: {}
      });
      await this.adapter.setStateChangedAsync(`${Radio.CHANNEL}.${nameClean}.url`, {
        val: station.url,
        ack: true
      });
    }
    const channels = await this.adapter.getObjectViewAsync("system", "channel", {
      startkey: `${this.adapter.namespace}.${Radio.CHANNEL}.`,
      endkey: `${this.adapter.namespace}.${Radio.CHANNEL}.\u9999`
    });
    for (const channel of channels.rows) {
      const idNoNamespace = this.adapter.removeNamespace(channel.id);
      const nameClean = idNoNamespace.substring(Radio.CHANNEL.length + 1);
      if (!nameClean.includes(".") && !this.stations.has(nameClean)) {
        this.adapter.log.debug(`[radio] Station "${nameClean}" has been removed - deleting objects`);
        await this.adapter.delObjectAsync(idNoNamespace, { recursive: true });
      }
    }
    this.adapter.log.debug(`[radio] Available stations: ${JSON.stringify([...this.stations.values()])}`);
  }
  async createBaseObjects() {
    await this.adapter.extendObject(Radio.CHANNEL, {
      type: "channel",
      common: {
        name: {
          en: "Internet radio",
          de: "Internetradio",
          ru: "\u0418\u043D\u0442\u0435\u0440\u043D\u0435\u0442-\u0440\u0430\u0434\u0438\u043E",
          pt: "R\xE1dio na Internet",
          nl: "Internetradio",
          fr: "Radio Internet",
          it: "Radio Internet",
          es: "Radio por Internet",
          pl: "Radio internetowe",
          uk: "\u0406\u043D\u0442\u0435\u0440\u043D\u0435\u0442-\u0440\u0430\u0434\u0456\u043E",
          "zh-cn": "\u7F51\u7EDC\u7535\u53F0"
        }
      },
      native: {}
    });
    await this.adapter.extendObject(`${Radio.CHANNEL}.playing`, {
      type: "state",
      common: {
        name: {
          en: "Playing",
          de: "Wiedergabe aktiv",
          ru: "\u0412\u043E\u0441\u043F\u0440\u043E\u0438\u0437\u0432\u043E\u0434\u0438\u0442\u0441\u044F",
          pt: "A reproduzir",
          nl: "Speelt af",
          fr: "En lecture",
          it: "In riproduzione",
          es: "Reproduciendo",
          pl: "Odtwarzanie",
          uk: "\u0412\u0456\u0434\u0442\u0432\u043E\u0440\u044E\u0454\u0442\u044C\u0441\u044F",
          "zh-cn": "\u6B63\u5728\u64AD\u653E"
        },
        type: "boolean",
        role: "indicator",
        read: true,
        write: false,
        def: false
      },
      native: {}
    });
    await this.adapter.extendObject(`${Radio.CHANNEL}.station`, {
      type: "state",
      common: {
        name: {
          en: "Current station",
          de: "Aktueller Sender",
          ru: "\u0422\u0435\u043A\u0443\u0449\u0430\u044F \u0441\u0442\u0430\u043D\u0446\u0438\u044F",
          pt: "Esta\xE7\xE3o atual",
          nl: "Huidige zender",
          fr: "Station actuelle",
          it: "Stazione attuale",
          es: "Emisora actual",
          pl: "Aktualna stacja",
          uk: "\u041F\u043E\u0442\u043E\u0447\u043D\u0430 \u0441\u0442\u0430\u043D\u0446\u0456\u044F",
          "zh-cn": "\u5F53\u524D\u7535\u53F0"
        },
        type: "string",
        role: "text",
        read: true,
        write: false,
        def: ""
      },
      native: {}
    });
    await this.adapter.extendObject(`${Radio.CHANNEL}.title`, {
      type: "state",
      common: {
        name: {
          en: "Current title",
          de: "Aktueller Titel",
          ru: "\u0422\u0435\u043A\u0443\u0449\u0438\u0439 \u0442\u0440\u0435\u043A",
          pt: "T\xEDtulo atual",
          nl: "Huidige titel",
          fr: "Titre actuel",
          it: "Titolo attuale",
          es: "T\xEDtulo actual",
          pl: "Aktualny tytu\u0142",
          uk: "\u041F\u043E\u0442\u043E\u0447\u043D\u0430 \u043D\u0430\u0437\u0432\u0430",
          "zh-cn": "\u5F53\u524D\u6807\u9898"
        },
        type: "string",
        role: "media.title",
        read: true,
        write: false,
        def: ""
      },
      native: {}
    });
    await this.adapter.extendObject(`${Radio.CHANNEL}.stop`, {
      type: "state",
      common: {
        name: {
          en: "Stop radio",
          de: "Radio stoppen",
          ru: "\u041E\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u0440\u0430\u0434\u0438\u043E",
          pt: "Parar r\xE1dio",
          nl: "Radio stoppen",
          fr: "Arr\xEAter la radio",
          it: "Ferma radio",
          es: "Detener radio",
          pl: "Zatrzymaj radio",
          uk: "\u0417\u0443\u043F\u0438\u043D\u0438\u0442\u0438 \u0440\u0430\u0434\u0456\u043E",
          "zh-cn": "\u505C\u6B62\u7535\u53F0"
        },
        type: "boolean",
        role: "button.stop",
        read: false,
        write: true
      },
      native: {}
    });
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Radio
});
//# sourceMappingURL=radio.js.map
