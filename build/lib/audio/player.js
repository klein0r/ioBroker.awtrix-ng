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
var player_exports = {};
__export(player_exports, {
  AudioPlayer: () => AudioPlayer
});
module.exports = __toCommonJS(player_exports);
class AudioPlayer {
  adapter;
  apiClient;
  /** clean name (object id) -> item name */
  items;
  itemsHash;
  lastState;
  refreshTimeout;
  /** Names of additional states in the channel (items with the same clean name are skipped) */
  extraStateIds = [];
  /** Check the playback state every few seconds while playing (e.g. short mp3 files) */
  followPlayback = false;
  constructor(adapter, apiClient) {
    this.adapter = adapter;
    this.apiClient = apiClient;
    this.items = /* @__PURE__ */ new Map();
    this.itemsHash = void 0;
    this.lastState = void 0;
    this.refreshTimeout = void 0;
  }
  /** Name of the playing item (null = not playing) */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getPlaying(audioState) {
    return null;
  }
  /** Optimistic update of the playback state (until the next refresh) */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setPlaying(audioState, name) {
  }
  hasPlaybackState() {
    return this.currentStateId !== null;
  }
  /** Additional objects of the channel (e.g. title) */
  async createExtraObjects() {
  }
  /** Additional states of the channel (e.g. title) */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async updateExtraStates(audioState) {
  }
  /** Additional objects of an item (e.g. url) */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async createItemExtraObjects(nameClean, item) {
  }
  /**
   * Reads items and playback state of the device - creates / deletes item objects if the list has changed
   *
   * @param forceObjectSync - create / check objects even if the item list is unchanged
   * @param audioState - current state (requested if missing)
   */
  async refresh(forceObjectSync, audioState) {
    const state = audioState != null ? audioState : await this.apiClient.audio.getState();
    const items = await this.loadItems(state);
    const itemsHash = JSON.stringify(items);
    if (forceObjectSync || itemsHash !== this.itemsHash) {
      await this.syncItemObjects(items);
      this.itemsHash = itemsHash;
    }
    if (this.hasPlaybackState()) {
      await this.updatePlaybackStates(state);
    }
    if (this.followPlayback && this.getPlaying(state) !== null) {
      this.scheduleRefresh();
    }
  }
  /**
   * Removes all objects (e.g. device does not support this feature)
   */
  async remove() {
    this.unload();
    this.items.clear();
    this.itemsHash = void 0;
    this.lastState = void 0;
    const channelObj = await this.adapter.getObjectAsync(this.channel);
    if (channelObj) {
      this.adapter.log.debug(`[${this.channel}] Not supported by device - deleting objects`);
      await this.adapter.delObjectAsync(this.channel, { recursive: true });
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
    if (idNoNamespace === `${this.channel}.stop`) {
      await this.stop();
      this.adapter.log.debug(`[${this.channel}] Stopped playback`);
      await this.adapter.setState(idNoNamespace, { val: state.val, ack: true });
      if (this.hasPlaybackState()) {
        await this.setPlayingStates(null);
        this.scheduleRefresh();
      }
      return;
    }
    const itemId = idNoNamespace.substring(this.channel.length + 1).split(".");
    const itemName = itemId.length === 2 && itemId[1] === this.getItemStateId() ? this.items.get(itemId[0]) : void 0;
    if (!itemName) {
      this.adapter.log.warn(`[${this.channel}] Unknown item for state ${idNoNamespace}`);
      return;
    }
    if (!this.hasPlaybackState()) {
      await this.play(itemName);
      this.adapter.log.debug(`[${this.channel}] Playing "${itemName}"`);
      await this.adapter.setState(idNoNamespace, { val: state.val, ack: true });
      return;
    }
    if (state.val) {
      await this.play(itemName);
      this.adapter.log.debug(`[${this.channel}] Playing "${itemName}"`);
      await this.setPlayingStates(itemName);
    } else if (this.lastState && this.getPlaying(this.lastState) === itemName) {
      await this.stop();
      this.adapter.log.debug(`[${this.channel}] Stopped "${itemName}"`);
      await this.setPlayingStates(null);
    } else {
      await this.adapter.setState(idNoNamespace, { val: false, ack: true });
    }
    this.scheduleRefresh();
  }
  /**
   * Sets the playing states of all items (optimistic - until the next refresh)
   *
   * @param name - playing item (null = stopped)
   */
  async setPlayingStates(name) {
    if (this.lastState) {
      this.setPlaying(this.lastState, name);
    }
    for (const [nameClean, itemName] of this.items) {
      await this.adapter.setState(`${this.channel}.${nameClean}.playing`, {
        val: itemName === name,
        ack: true
      });
    }
    await this.adapter.setStateChangedAsync(`${this.channel}.playing`, { val: name !== null, ack: true });
    await this.adapter.setStateChangedAsync(`${this.channel}.${this.currentStateId}`, {
      val: name != null ? name : "",
      ack: true
    });
  }
  /** State of an item which starts the playback */
  getItemStateId() {
    return this.hasPlaybackState() ? "playing" : "play";
  }
  scheduleRefresh() {
    this.unload();
    this.refreshTimeout = this.adapter.setTimeout(async () => {
      this.refreshTimeout = void 0;
      if (this.adapter.isApiConnected()) {
        await this.refresh(false).catch((error) => {
          this.adapter.log.debug(`[${this.channel}] Unable to refresh state: ${error}`);
        });
      }
    }, 5e3);
  }
  async updatePlaybackStates(audioState) {
    this.lastState = audioState;
    const playing = this.getPlaying(audioState);
    await this.adapter.setStateChangedAsync(`${this.channel}.playing`, { val: playing !== null, ack: true });
    await this.adapter.setStateChangedAsync(`${this.channel}.${this.currentStateId}`, {
      val: playing != null ? playing : "",
      ack: true
    });
    await this.updateExtraStates(audioState);
    for (const [nameClean, name] of this.items) {
      await this.adapter.setStateChangedAsync(`${this.channel}.${nameClean}.playing`, {
        val: playing === name,
        ack: true
      });
    }
  }
  cleanName(name) {
    return name.replace(this.adapter.FORBIDDEN_CHARS, "_").replace(/[.\s/]+/g, "_").replace(/_{2,}/g, "_").replace(/^_+|_+$/g, "");
  }
  async syncItemObjects(items) {
    await this.createBaseObjects();
    const reservedNames = [
      "playing",
      "stop",
      ...this.currentStateId ? [this.currentStateId] : [],
      ...this.extraStateIds
    ];
    this.items.clear();
    for (const item of items) {
      const nameClean = this.cleanName(item.name);
      if (!nameClean || reservedNames.includes(nameClean)) {
        this.adapter.log.warn(`[${this.channel}] Name "${item.name}" is reserved or invalid - skipping`);
        continue;
      }
      if (this.items.has(nameClean)) {
        this.adapter.log.warn(
          `[${this.channel}] "${item.name}" has the same object id as "${this.items.get(nameClean)}" - skipping`
        );
        continue;
      }
      this.items.set(nameClean, item.name);
      await this.adapter.extendObject(`${this.channel}.${nameClean}`, {
        type: "channel",
        common: {
          name: item.name
        },
        native: {
          name: item.name
        }
      });
      if (this.hasPlaybackState()) {
        await this.adapter.extendObject(`${this.channel}.${nameClean}.playing`, {
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
      } else {
        await this.adapter.extendObject(`${this.channel}.${nameClean}.play`, {
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
            type: "boolean",
            role: "button.play",
            read: false,
            write: true
          },
          native: {}
        });
      }
      await this.createItemExtraObjects(nameClean, item);
    }
    const channels = await this.adapter.getObjectViewAsync("system", "channel", {
      startkey: `${this.adapter.namespace}.${this.channel}.`,
      endkey: `${this.adapter.namespace}.${this.channel}.\u9999`
    });
    for (const channel of channels.rows) {
      const idNoNamespace = this.adapter.removeNamespace(channel.id);
      const nameClean = idNoNamespace.substring(this.channel.length + 1);
      if (!nameClean.includes(".") && !this.items.has(nameClean)) {
        this.adapter.log.debug(`[${this.channel}] "${nameClean}" has been removed - deleting objects`);
        await this.adapter.delObjectAsync(idNoNamespace, { recursive: true });
      }
    }
    this.adapter.log.debug(`[${this.channel}] Available: ${JSON.stringify([...this.items.values()])}`);
  }
  async createBaseObjects() {
    await this.adapter.extendObject(this.channel, {
      type: "channel",
      common: {
        name: this.channelName
      },
      native: {}
    });
    if (this.hasPlaybackState()) {
      await this.createPlaybackStateObjects();
    }
    await this.adapter.extendObject(`${this.channel}.stop`, {
      type: "state",
      common: {
        name: this.stopStateName,
        type: "boolean",
        role: "button.stop",
        read: false,
        write: true
      },
      native: {}
    });
    await this.createExtraObjects();
  }
  async createPlaybackStateObjects() {
    await this.adapter.extendObject(`${this.channel}.playing`, {
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
    await this.adapter.extendObject(`${this.channel}.${this.currentStateId}`, {
      type: "state",
      common: {
        name: this.currentStateName,
        type: "string",
        role: "text",
        read: true,
        write: false,
        def: ""
      },
      native: {}
    });
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AudioPlayer
});
//# sourceMappingURL=player.js.map
