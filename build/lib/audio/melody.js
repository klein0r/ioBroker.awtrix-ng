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
var melody_exports = {};
__export(melody_exports, {
  Melody: () => Melody
});
module.exports = __toCommonJS(melody_exports);
var import_player = require("./player");
class Melody extends import_player.AudioPlayer {
  channel = "audio.melody";
  channelName = {
    en: "Melodies",
    de: "Melodien",
    ru: "\u041C\u0435\u043B\u043E\u0434\u0438\u0438",
    pt: "Melodias",
    nl: "Melodie\xEBn",
    fr: "M\xE9lodies",
    it: "Melodie",
    es: "Melod\xEDas",
    pl: "Melodie",
    uk: "\u041C\u0435\u043B\u043E\u0434\u0456\u0457",
    "zh-cn": "\u65CB\u5F8B"
  };
  // no playback state available
  currentStateId = null;
  currentStateName = "";
  stopStateName = {
    en: "Stop melody",
    de: "Melodie stoppen",
    ru: "\u041E\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u043C\u0435\u043B\u043E\u0434\u0438\u044E",
    pt: "Parar melodia",
    nl: "Melodie stoppen",
    fr: "Arr\xEAter la m\xE9lodie",
    it: "Ferma melodia",
    es: "Detener melod\xEDa",
    pl: "Zatrzymaj melodi\u0119",
    uk: "\u0417\u0443\u043F\u0438\u043D\u0438\u0442\u0438 \u043C\u0435\u043B\u043E\u0434\u0456\u044E",
    "zh-cn": "\u505C\u6B62\u65CB\u5F8B"
  };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async loadItems(audioState) {
    const melodyList = await this.apiClient.audio.listMelodies();
    for (const melody of melodyList.melodies.filter((m) => !m.valid)) {
      this.adapter.log.debug(`[${this.channel}] Skipping invalid melody "${melody.name}": ${melody.error}`);
    }
    return melodyList.melodies.filter((m) => m.valid);
  }
  async play(name) {
    await this.apiClient.audio.play({ melody: name });
  }
  async stop() {
    await this.apiClient.audio.stop("sounds");
  }
  async createItemExtraObjects(nameClean, item) {
    await this.adapter.extendObject(`${this.channel}.${nameClean}.rtttl`, {
      type: "state",
      common: {
        name: "RTTTL",
        type: "string",
        role: "text",
        read: true,
        write: false
      },
      native: {}
    });
    await this.adapter.extendObject(`${this.channel}.${nameClean}.duration`, {
      type: "state",
      common: {
        name: {
          en: "Duration",
          de: "Dauer",
          ru: "\u041F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C",
          pt: "Dura\xE7\xE3o",
          nl: "Duur",
          fr: "Dur\xE9e",
          it: "Durata",
          es: "Duraci\xF3n",
          pl: "Czas trwania",
          uk: "\u0422\u0440\u0438\u0432\u0430\u043B\u0456\u0441\u0442\u044C",
          "zh-cn": "\u65F6\u957F"
        },
        type: "number",
        role: "value",
        unit: "ms",
        read: true,
        write: false
      },
      native: {}
    });
    await this.adapter.setStateChangedAsync(`${this.channel}.${nameClean}.rtttl`, { val: item.rtttl, ack: true });
    await this.adapter.setStateChangedAsync(`${this.channel}.${nameClean}.duration`, {
      val: item.durationMs,
      ack: true
    });
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Melody
});
//# sourceMappingURL=melody.js.map
