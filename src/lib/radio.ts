import type { AudioState, AwtrixClient } from 'awtrix-ng-api';
import type { AwtrixNg } from '../awtrix-ng';

/**
 * Internet radio (e.g. Ulanzi TC002): one channel per station under audio.radio.<station>.
 * The stations are maintained in the web interface of the device - ioBroker just plays them.
 */
export class Radio {
    private static readonly CHANNEL = 'audio.radio';

    /** Names of the global states in audio.radio - stations with the same (clean) name are skipped */
    private static readonly RESERVED_NAMES = ['playing', 'station', 'title', 'stop'];

    private adapter: AwtrixNg;
    private apiClient: AwtrixClient;

    /** clean name (object id) -> station name */
    private stations: Map<string, string>;
    private stationsHash: string | undefined;
    private lastState: AudioState | undefined;
    private refreshTimeout: ioBroker.Timeout | undefined;

    public constructor(adapter: AwtrixNg, apiClient: AwtrixClient) {
        this.adapter = adapter;
        this.apiClient = apiClient;

        this.stations = new Map();
        this.stationsHash = undefined;
        this.lastState = undefined;
        this.refreshTimeout = undefined;
    }

    /**
     * Reads stations and playback state of the device - creates / deletes station objects if the list has changed
     *
     * @param forceObjectSync - create / check objects even if the station list is unchanged
     */
    public async refresh(forceObjectSync: boolean): Promise<void> {
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
    public async remove(): Promise<void> {
        this.stations.clear();
        this.stationsHash = undefined;
        this.lastState = undefined;

        const channelObj = await this.adapter.getObjectAsync(Radio.CHANNEL);
        if (channelObj) {
            this.adapter.log.debug(`[radio] Device does not support radio - deleting objects`);
            await this.adapter.delObjectAsync(Radio.CHANNEL, { recursive: true });
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
        if (idNoNamespace === `${Radio.CHANNEL}.stop`) {
            await this.apiClient.audio.stop('stream');
            this.adapter.log.debug('[radio] Stopped radio');

            await this.adapter.setState(idNoNamespace, { val: state.val, ack: true });
            await this.setPlayingStation(null);
            this.scheduleRefresh();

            return;
        }

        const matches = idNoNamespace.match(/^audio\.radio\.([^.]+)\.playing$/);
        const stationName = matches ? this.stations.get(matches[1]) : undefined;

        if (!stationName) {
            this.adapter.log.warn(`[radio] Unknown station for state ${idNoNamespace}`);
            return;
        }

        if (state.val) {
            await this.apiClient.audio.playStation(stationName);
            this.adapter.log.debug(`[radio] Playing station "${stationName}"`);

            await this.setPlayingStation(stationName);
        } else if (this.getPlayingStation() === stationName) {
            await this.apiClient.audio.stop('stream');
            this.adapter.log.debug(`[radio] Stopped station "${stationName}"`);

            await this.setPlayingStation(null);
        } else {
            // Station is not playing - nothing to stop
            await this.adapter.setState(idNoNamespace, { val: false, ack: true });
        }

        // Starting a stream takes some time - check the real state again
        this.scheduleRefresh();
    }

    private getPlayingStation(): string | null {
        return this.lastState?.radio.playing ? this.lastState.radio.station : null;
    }

    /**
     * Sets the playing states of all stations (optimistic - until the next refresh)
     *
     * @param stationName - playing station (null = stopped)
     */
    private async setPlayingStation(stationName: string | null): Promise<void> {
        if (this.lastState) {
            this.lastState.radio.playing = stationName !== null;
            this.lastState.radio.station = stationName ?? '';
        }

        for (const [nameClean, name] of this.stations) {
            await this.adapter.setState(`${Radio.CHANNEL}.${nameClean}.playing`, {
                val: name === stationName,
                ack: true,
            });
        }

        await this.adapter.setStateChangedAsync(`${Radio.CHANNEL}.playing`, { val: stationName !== null, ack: true });
        await this.adapter.setStateChangedAsync(`${Radio.CHANNEL}.station`, { val: stationName ?? '', ack: true });
    }

    private scheduleRefresh(): void {
        this.unload();

        this.refreshTimeout = this.adapter.setTimeout(async () => {
            this.refreshTimeout = undefined;

            if (this.adapter.isApiConnected()) {
                await this.refresh(false).catch(error => {
                    this.adapter.log.debug(`[radio] Unable to refresh state: ${error}`);
                });
            }
        }, 5_000);
    }

    private async updatePlaybackStates(audioState: AudioState): Promise<void> {
        this.lastState = audioState;

        const { playing, station, title } = audioState.radio;

        await this.adapter.setStateChangedAsync(`${Radio.CHANNEL}.playing`, { val: playing, ack: true });
        await this.adapter.setStateChangedAsync(`${Radio.CHANNEL}.station`, {
            val: playing ? station : '',
            ack: true,
        });
        await this.adapter.setStateChangedAsync(`${Radio.CHANNEL}.title`, { val: playing ? title : '', ack: true });

        for (const [nameClean, name] of this.stations) {
            await this.adapter.setStateChangedAsync(`${Radio.CHANNEL}.${nameClean}.playing`, {
                val: playing && station === name,
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

    private async syncStationObjects(audioState: AudioState): Promise<void> {
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
                    `[radio] Station "${station.name}" has the same object id as "${this.stations.get(nameClean)}" - skipping`,
                );
                continue;
            }

            this.stations.set(nameClean, station.name);

            await this.adapter.extendObject(`${Radio.CHANNEL}.${nameClean}`, {
                type: 'channel',
                common: {
                    name: station.name,
                },
                native: {
                    station: station.name,
                },
            });

            await this.adapter.extendObject(`${Radio.CHANNEL}.${nameClean}.playing`, {
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

            await this.adapter.extendObject(`${Radio.CHANNEL}.${nameClean}.url`, {
                type: 'state',
                common: {
                    name: {
                        en: 'Stream URL',
                        de: 'Stream-URL',
                        ru: 'URL потока',
                        pt: 'URL do stream',
                        nl: 'Stream-URL',
                        fr: 'URL du flux',
                        it: 'URL dello stream',
                        es: 'URL del stream',
                        pl: 'Adres URL strumienia',
                        uk: 'URL потоку',
                        'zh-cn': '流地址',
                    },
                    type: 'string',
                    role: 'text.url',
                    read: true,
                    write: false,
                },
                native: {},
            });

            await this.adapter.setStateChangedAsync(`${Radio.CHANNEL}.${nameClean}.url`, {
                val: station.url,
                ack: true,
            });
        }

        // Delete stations which have been removed on the device
        const channels = await this.adapter.getObjectViewAsync('system', 'channel', {
            startkey: `${this.adapter.namespace}.${Radio.CHANNEL}.`,
            endkey: `${this.adapter.namespace}.${Radio.CHANNEL}.香`,
        });

        for (const channel of channels.rows) {
            const idNoNamespace = this.adapter.removeNamespace(channel.id);
            const nameClean = idNoNamespace.substring(Radio.CHANNEL.length + 1);

            if (!nameClean.includes('.') && !this.stations.has(nameClean)) {
                this.adapter.log.debug(`[radio] Station "${nameClean}" has been removed - deleting objects`);
                await this.adapter.delObjectAsync(idNoNamespace, { recursive: true });
            }
        }

        this.adapter.log.debug(`[radio] Available stations: ${JSON.stringify([...this.stations.values()])}`);
    }

    private async createBaseObjects(): Promise<void> {
        await this.adapter.extendObject(Radio.CHANNEL, {
            type: 'channel',
            common: {
                name: {
                    en: 'Internet radio',
                    de: 'Internetradio',
                    ru: 'Интернет-радио',
                    pt: 'Rádio na Internet',
                    nl: 'Internetradio',
                    fr: 'Radio Internet',
                    it: 'Radio Internet',
                    es: 'Radio por Internet',
                    pl: 'Radio internetowe',
                    uk: 'Інтернет-радіо',
                    'zh-cn': '网络电台',
                },
            },
            native: {},
        });

        await this.adapter.extendObject(`${Radio.CHANNEL}.playing`, {
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

        await this.adapter.extendObject(`${Radio.CHANNEL}.station`, {
            type: 'state',
            common: {
                name: {
                    en: 'Current station',
                    de: 'Aktueller Sender',
                    ru: 'Текущая станция',
                    pt: 'Estação atual',
                    nl: 'Huidige zender',
                    fr: 'Station actuelle',
                    it: 'Stazione attuale',
                    es: 'Emisora actual',
                    pl: 'Aktualna stacja',
                    uk: 'Поточна станція',
                    'zh-cn': '当前电台',
                },
                type: 'string',
                role: 'text',
                read: true,
                write: false,
                def: '',
            },
            native: {},
        });

        await this.adapter.extendObject(`${Radio.CHANNEL}.title`, {
            type: 'state',
            common: {
                name: {
                    en: 'Current title',
                    de: 'Aktueller Titel',
                    ru: 'Текущий трек',
                    pt: 'Título atual',
                    nl: 'Huidige titel',
                    fr: 'Titre actuel',
                    it: 'Titolo attuale',
                    es: 'Título actual',
                    pl: 'Aktualny tytuł',
                    uk: 'Поточна назва',
                    'zh-cn': '当前标题',
                },
                type: 'string',
                role: 'media.title',
                read: true,
                write: false,
                def: '',
            },
            native: {},
        });

        await this.adapter.extendObject(`${Radio.CHANNEL}.stop`, {
            type: 'state',
            common: {
                name: {
                    en: 'Stop radio',
                    de: 'Radio stoppen',
                    ru: 'Остановить радио',
                    pt: 'Parar rádio',
                    nl: 'Radio stoppen',
                    fr: 'Arrêter la radio',
                    it: 'Ferma radio',
                    es: 'Detener radio',
                    pl: 'Zatrzymaj radio',
                    uk: 'Зупинити радіо',
                    'zh-cn': '停止电台',
                },
                type: 'boolean',
                role: 'button.stop',
                read: false,
                write: true,
            },
            native: {},
        });
    }
}
