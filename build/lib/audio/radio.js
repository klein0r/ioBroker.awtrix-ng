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
var import_player = require("./player");
class Radio extends import_player.AudioPlayer {
  channel = "audio.radio";
  channelName = {
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
  };
  currentStateId = "station";
  currentStateName = {
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
  };
  stopStateName = {
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
  };
  extraStateIds = ["title"];
  // eslint-disable-next-line @typescript-eslint/require-await
  async loadItems(audioState) {
    return audioState.stations;
  }
  getPlaying(audioState) {
    return audioState.radio.playing ? audioState.radio.station : null;
  }
  setPlaying(audioState, name) {
    audioState.radio.playing = name !== null;
    audioState.radio.station = name != null ? name : "";
  }
  async play(name) {
    await this.apiClient.audio.playStation(name);
  }
  async stop() {
    await this.apiClient.audio.stop("radio");
  }
  async createExtraObjects() {
    await this.adapter.extendObject(`${this.channel}.title`, {
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
  }
  async updateExtraStates(audioState) {
    const { playing, title } = audioState.radio;
    await this.adapter.setStateChangedAsync(`${this.channel}.title`, { val: playing ? title : "", ack: true });
  }
  async createItemExtraObjects(nameClean, item) {
    await this.adapter.extendObject(`${this.channel}.${nameClean}.url`, {
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
    await this.adapter.setStateChangedAsync(`${this.channel}.${nameClean}.url`, { val: item.url, ack: true });
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Radio
});
//# sourceMappingURL=radio.js.map
