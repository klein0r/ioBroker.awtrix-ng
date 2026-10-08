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
var mp3_exports = {};
__export(mp3_exports, {
  Mp3: () => Mp3
});
module.exports = __toCommonJS(mp3_exports);
var import_player = require("./player");
class Mp3 extends import_player.AudioPlayer {
  channel = "audio.mp3";
  channelName = {
    en: "MP3 files",
    de: "MP3-Dateien",
    ru: "MP3-\u0444\u0430\u0439\u043B\u044B",
    pt: "Ficheiros MP3",
    nl: "MP3-bestanden",
    fr: "Fichiers MP3",
    it: "File MP3",
    es: "Archivos MP3",
    pl: "Pliki MP3",
    uk: "MP3-\u0444\u0430\u0439\u043B\u0438",
    "zh-cn": "MP3 \u6587\u4EF6"
  };
  currentStateId = "file";
  currentStateName = {
    en: "Current file",
    de: "Aktuelle Datei",
    ru: "\u0422\u0435\u043A\u0443\u0449\u0438\u0439 \u0444\u0430\u0439\u043B",
    pt: "Ficheiro atual",
    nl: "Huidig bestand",
    fr: "Fichier actuel",
    it: "File attuale",
    es: "Archivo actual",
    pl: "Aktualny plik",
    uk: "\u041F\u043E\u0442\u043E\u0447\u043D\u0438\u0439 \u0444\u0430\u0439\u043B",
    "zh-cn": "\u5F53\u524D\u6587\u4EF6"
  };
  stopStateName = {
    en: "Stop MP3",
    de: "MP3 stoppen",
    ru: "\u041E\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C MP3",
    pt: "Parar MP3",
    nl: "MP3 stoppen",
    fr: "Arr\xEAter le MP3",
    it: "Ferma MP3",
    es: "Detener MP3",
    pl: "Zatrzymaj MP3",
    uk: "\u0417\u0443\u043F\u0438\u043D\u0438\u0442\u0438 MP3",
    "zh-cn": "\u505C\u6B62 MP3"
  };
  // Files are short - the playing state changes without any action
  followPlayback = true;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async loadItems(audioState) {
    const mp3List = await this.apiClient.audio.listMp3();
    return mp3List.files.map((f) => ({
      name: f.name.replace(/\.mp3$/i, ""),
      // played (and reported) without extension
      file: f.name,
      size: f.size
    }));
  }
  getPlaying(audioState) {
    return audioState.alert.playing ? audioState.alert.name : null;
  }
  setPlaying(audioState, name) {
    audioState.alert.playing = name !== null;
    audioState.alert.name = name != null ? name : "";
  }
  async play(name) {
    await this.apiClient.audio.playFile(name);
  }
  async stop() {
    await this.apiClient.audio.stop("alert");
  }
  async createItemExtraObjects(nameClean, item) {
    await this.adapter.extendObject(`${this.channel}.${nameClean}.size`, {
      type: "state",
      common: {
        name: {
          en: "File size",
          de: "Dateigr\xF6\xDFe",
          ru: "\u0420\u0430\u0437\u043C\u0435\u0440 \u0444\u0430\u0439\u043B\u0430",
          pt: "Tamanho do ficheiro",
          nl: "Bestandsgrootte",
          fr: "Taille du fichier",
          it: "Dimensione del file",
          es: "Tama\xF1o del archivo",
          pl: "Rozmiar pliku",
          uk: "\u0420\u043E\u0437\u043C\u0456\u0440 \u0444\u0430\u0439\u043B\u0443",
          "zh-cn": "\u6587\u4EF6\u5927\u5C0F"
        },
        type: "number",
        role: "value",
        unit: "bytes",
        read: true,
        write: false
      },
      native: {}
    });
    await this.adapter.setStateChangedAsync(`${this.channel}.${nameClean}.size`, { val: item.size, ack: true });
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Mp3
});
//# sourceMappingURL=mp3.js.map
