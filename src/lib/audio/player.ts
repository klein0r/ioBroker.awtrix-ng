import type { AudioState, AwtrixClient } from 'awtrix-ng-api';
import type { AwtrixNg } from '../../awtrix-ng';

/** An item which can be played (e.g. radio station or mp3 file) */
export type PlayerItem = {
    name: string;
};

/**
 * Base class for audio sources of the device (radio, mp3, melodies): one channel per item under
 * <channel>.<item> with a switch "playing" (or a button "play" if the device does not report the playback state).
 * The items are maintained on the device - ioBroker just plays them.
 */
export abstract class AudioPlayer<Item extends PlayerItem> {
    protected adapter: AwtrixNg;
    protected apiClient: AwtrixClient;

    /** clean name (object id) -> item name */
    protected items: Map<string, string>;
    private itemsHash: string | undefined;
    private lastState: AudioState | undefined;
    private refreshTimeout: ioBroker.Timeout | undefined;

    /** Object id of the channel, e.g. audio.radio */
    protected abstract readonly channel: string;
    protected abstract readonly channelName: ioBroker.StringOrTranslated;

    /**
     * Id (below channel) of the state with the name of the playing item, e.g. station
     * (null = the device does not report the playback state - items get a button "play" instead of a switch "playing")
     */
    protected abstract readonly currentStateId: string | null;
    protected abstract readonly currentStateName: ioBroker.StringOrTranslated;
    protected abstract readonly stopStateName: ioBroker.StringOrTranslated;

    /** Names of additional states in the channel (items with the same clean name are skipped) */
    protected readonly extraStateIds: Array<string> = [];

    /** Check the playback state every few seconds while playing (e.g. short mp3 files) */
    protected readonly followPlayback: boolean = false;

    public constructor(adapter: AwtrixNg, apiClient: AwtrixClient) {
        this.adapter = adapter;
        this.apiClient = apiClient;

        this.items = new Map();
        this.itemsHash = undefined;
        this.lastState = undefined;
        this.refreshTimeout = undefined;
    }

    /** Items available on the device */
    protected abstract loadItems(audioState: AudioState): Promise<Array<Item>>;

    /** Name of the playing item (null = not playing) */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected getPlaying(audioState: AudioState): string | null {
        return null;
    }

    /** Optimistic update of the playback state (until the next refresh) */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected setPlaying(audioState: AudioState, name: string | null): void {
        // override
    }

    private hasPlaybackState(): boolean {
        return this.currentStateId !== null;
    }

    protected abstract play(name: string): Promise<void>;

    protected abstract stop(): Promise<void>;

    /** Additional objects of the channel (e.g. title) */
    protected async createExtraObjects(): Promise<void> {
        // override
    }

    /** Additional states of the channel (e.g. title) */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected async updateExtraStates(audioState: AudioState): Promise<void> {
        // override
    }

    /** Additional objects of an item (e.g. url) */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected async createItemExtraObjects(nameClean: string, item: Item): Promise<void> {
        // override
    }

    /**
     * Reads items and playback state of the device - creates / deletes item objects if the list has changed
     *
     * @param forceObjectSync - create / check objects even if the item list is unchanged
     * @param audioState - current state (requested if missing)
     */
    public async refresh(forceObjectSync: boolean, audioState?: AudioState): Promise<void> {
        const state = audioState ?? (await this.apiClient.audio.getState());
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
    public async remove(): Promise<void> {
        this.unload();

        this.items.clear();
        this.itemsHash = undefined;
        this.lastState = undefined;

        const channelObj = await this.adapter.getObjectAsync(this.channel);
        if (channelObj) {
            this.adapter.log.debug(`[${this.channel}] Not supported by device - deleting objects`);
            await this.adapter.delObjectAsync(this.channel, { recursive: true });
        }
    }

    public unload(): void {
        if (this.refreshTimeout) {
            this.adapter.clearTimeout(this.refreshTimeout);
            this.refreshTimeout = undefined;
        }
    }

    /**
     * Handles write actions of the user
     *
     * @param idNoNamespace - state id without namespace
     * @param state - new state (ack: false)
     */
    public async onStateChange(idNoNamespace: string, state: ioBroker.State): Promise<void> {
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

        const itemId = idNoNamespace.substring(this.channel.length + 1).split('.');
        const itemName =
            itemId.length === 2 && itemId[1] === this.getItemStateId() ? this.items.get(itemId[0]) : undefined;

        if (!itemName) {
            this.adapter.log.warn(`[${this.channel}] Unknown item for state ${idNoNamespace}`);
            return;
        }

        // Button "play" - playback state is unknown
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
            // Item is not playing - nothing to stop
            await this.adapter.setState(idNoNamespace, { val: false, ack: true });
        }

        // Starting a stream takes some time - check the real state again
        this.scheduleRefresh();
    }

    /**
     * Sets the playing states of all items (optimistic - until the next refresh)
     *
     * @param name - playing item (null = stopped)
     */
    private async setPlayingStates(name: string | null): Promise<void> {
        if (this.lastState) {
            this.setPlaying(this.lastState, name);
        }

        for (const [nameClean, itemName] of this.items) {
            await this.adapter.setState(`${this.channel}.${nameClean}.playing`, {
                val: itemName === name,
                ack: true,
            });
        }

        await this.adapter.setStateChangedAsync(`${this.channel}.playing`, { val: name !== null, ack: true });
        await this.adapter.setStateChangedAsync(`${this.channel}.${this.currentStateId}`, {
            val: name ?? '',
            ack: true,
        });
    }

    /** State of an item which starts the playback */
    private getItemStateId(): string {
        return this.hasPlaybackState() ? 'playing' : 'play';
    }

    private scheduleRefresh(): void {
        this.unload();

        this.refreshTimeout = this.adapter.setTimeout(async () => {
            this.refreshTimeout = undefined;

            if (this.adapter.isApiConnected()) {
                await this.refresh(false).catch(error => {
                    this.adapter.log.debug(`[${this.channel}] Unable to refresh state: ${error}`);
                });
            }
        }, 5_000);
    }

    private async updatePlaybackStates(audioState: AudioState): Promise<void> {
        this.lastState = audioState;

        const playing = this.getPlaying(audioState);

        await this.adapter.setStateChangedAsync(`${this.channel}.playing`, { val: playing !== null, ack: true });
        await this.adapter.setStateChangedAsync(`${this.channel}.${this.currentStateId}`, {
            val: playing ?? '',
            ack: true,
        });
        await this.updateExtraStates(audioState);

        for (const [nameClean, name] of this.items) {
            await this.adapter.setStateChangedAsync(`${this.channel}.${nameClean}.playing`, {
                val: playing === name,
                ack: true,
            });
        }
    }

    private cleanName(name: string): string {
        return name
            .replace(this.adapter.FORBIDDEN_CHARS, '_')
            .replace(/[.\s/]+/g, '_')
            .replace(/_{2,}/g, '_')
            .replace(/^_+|_+$/g, '');
    }

    private async syncItemObjects(items: Array<Item>): Promise<void> {
        await this.createBaseObjects();

        const reservedNames = [
            'playing',
            'stop',
            ...(this.currentStateId ? [this.currentStateId] : []),
            ...this.extraStateIds,
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
                    `[${this.channel}] "${item.name}" has the same object id as "${this.items.get(nameClean)}" - skipping`,
                );
                continue;
            }

            this.items.set(nameClean, item.name);

            await this.adapter.extendObject(`${this.channel}.${nameClean}`, {
                type: 'channel',
                common: {
                    name: item.name,
                },
                native: {
                    name: item.name,
                },
            });

            if (this.hasPlaybackState()) {
                await this.adapter.extendObject(`${this.channel}.${nameClean}.playing`, {
                    type: 'state',
                    common: {
                        name: {
                            en: 'Play',
                            de: 'Abspielen',
                            ru: 'Воспроизвести',
                            pt: 'Reproduzir',
                            nl: 'Afspelen',
                            fr: 'Lecture',
                            it: 'Riproduci',
                            es: 'Reproducir',
                            pl: 'Odtwórz',
                            uk: 'Відтворити',
                            'zh-cn': '播放',
                        },
                        desc: 'true = play, false = stop',
                        type: 'boolean',
                        role: 'switch',
                        read: true,
                        write: true,
                        def: false,
                    },
                    native: {},
                });
            } else {
                await this.adapter.extendObject(`${this.channel}.${nameClean}.play`, {
                    type: 'state',
                    common: {
                        name: {
                            en: 'Play',
                            de: 'Abspielen',
                            ru: 'Воспроизвести',
                            pt: 'Reproduzir',
                            nl: 'Afspelen',
                            fr: 'Lecture',
                            it: 'Riproduci',
                            es: 'Reproducir',
                            pl: 'Odtwórz',
                            uk: 'Відтворити',
                            'zh-cn': '播放',
                        },
                        type: 'boolean',
                        role: 'button.play',
                        read: false,
                        write: true,
                    },
                    native: {},
                });
            }

            await this.createItemExtraObjects(nameClean, item);
        }

        // Delete items which have been removed on the device
        const channels = await this.adapter.getObjectViewAsync('system', 'channel', {
            startkey: `${this.adapter.namespace}.${this.channel}.`,
            endkey: `${this.adapter.namespace}.${this.channel}.香`,
        });

        for (const channel of channels.rows) {
            const idNoNamespace = this.adapter.removeNamespace(channel.id);
            const nameClean = idNoNamespace.substring(this.channel.length + 1);

            if (!nameClean.includes('.') && !this.items.has(nameClean)) {
                this.adapter.log.debug(`[${this.channel}] "${nameClean}" has been removed - deleting objects`);
                await this.adapter.delObjectAsync(idNoNamespace, { recursive: true });
            }
        }

        this.adapter.log.debug(`[${this.channel}] Available: ${JSON.stringify([...this.items.values()])}`);
    }

    private async createBaseObjects(): Promise<void> {
        await this.adapter.extendObject(this.channel, {
            type: 'channel',
            common: {
                name: this.channelName,
            },
            native: {},
        });

        if (this.hasPlaybackState()) {
            await this.createPlaybackStateObjects();
        }

        await this.adapter.extendObject(`${this.channel}.stop`, {
            type: 'state',
            common: {
                name: this.stopStateName,
                type: 'boolean',
                role: 'button.stop',
                read: false,
                write: true,
            },
            native: {},
        });

        await this.createExtraObjects();
    }

    private async createPlaybackStateObjects(): Promise<void> {
        await this.adapter.extendObject(`${this.channel}.playing`, {
            type: 'state',
            common: {
                name: {
                    en: 'Playing',
                    de: 'Wiedergabe aktiv',
                    ru: 'Воспроизводится',
                    pt: 'A reproduzir',
                    nl: 'Speelt af',
                    fr: 'En lecture',
                    it: 'In riproduzione',
                    es: 'Reproduciendo',
                    pl: 'Odtwarzanie',
                    uk: 'Відтворюється',
                    'zh-cn': '正在播放',
                },
                type: 'boolean',
                role: 'indicator',
                read: true,
                write: false,
                def: false,
            },
            native: {},
        });

        await this.adapter.extendObject(`${this.channel}.${this.currentStateId}`, {
            type: 'state',
            common: {
                name: this.currentStateName,
                type: 'string',
                role: 'text',
                read: true,
                write: false,
                def: '',
            },
            native: {},
        });
    }
}
