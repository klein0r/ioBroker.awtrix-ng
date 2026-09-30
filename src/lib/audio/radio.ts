import type { AudioState, RadioStation } from 'awtrix-ng-api';
import { AudioPlayer } from './player';

/**
 * Internet radio (e.g. Ulanzi TC002): one channel per station under audio.radio.<station>.
 * The stations are maintained in the web interface of the device - ioBroker just plays them.
 */
export class Radio extends AudioPlayer<RadioStation> {
    protected readonly channel = 'audio.radio';
    protected readonly channelName: ioBroker.StringOrTranslated = {
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
    };

    protected readonly currentStateId = 'station';
    protected readonly currentStateName: ioBroker.StringOrTranslated = {
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
    };
    protected readonly stopStateName: ioBroker.StringOrTranslated = {
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
    };

    protected override readonly extraStateIds = ['title'];

    // eslint-disable-next-line @typescript-eslint/require-await
    protected async loadItems(audioState: AudioState): Promise<Array<RadioStation>> {
        return audioState.stations;
    }

    protected override getPlaying(audioState: AudioState): string | null {
        // station contains the last station (even if stopped)
        return audioState.radio.playing ? audioState.radio.station : null;
    }

    protected override setPlaying(audioState: AudioState, name: string | null): void {
        audioState.radio.playing = name !== null;
        audioState.radio.station = name ?? '';
    }

    protected async play(name: string): Promise<void> {
        await this.apiClient.audio.playStation(name);
    }

    protected async stop(): Promise<void> {
        await this.apiClient.audio.stop('stream');
    }

    protected override async createExtraObjects(): Promise<void> {
        await this.adapter.extendObject(`${this.channel}.title`, {
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
    }

    protected override async updateExtraStates(audioState: AudioState): Promise<void> {
        const { playing, title } = audioState.radio;

        await this.adapter.setStateChangedAsync(`${this.channel}.title`, { val: playing ? title : '', ack: true });
    }

    protected override async createItemExtraObjects(nameClean: string, item: RadioStation): Promise<void> {
        await this.adapter.extendObject(`${this.channel}.${nameClean}.url`, {
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

        await this.adapter.setStateChangedAsync(`${this.channel}.${nameClean}.url`, { val: item.url, ack: true });
    }
}
