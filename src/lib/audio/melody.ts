import type { AudioState, Melody as MelodyItem } from 'awtrix-ng-api';
import { AudioPlayer } from './player';

/**
 * Melodies (RTTTL) stored on the device: one channel per melody under audio.melody.<melody> with a button "play".
 * The device does not report if a melody is playing - so there is no playback state.
 * The melodies are maintained in the web interface of the device - ioBroker just plays them.
 */
export class Melody extends AudioPlayer<MelodyItem> {
    protected readonly channel = 'audio.melody';
    protected readonly channelName: ioBroker.StringOrTranslated = {
        en: 'Melodies',
        de: 'Melodien',
        ru: 'Мелодии',
        pt: 'Melodias',
        nl: 'Melodieën',
        fr: 'Mélodies',
        it: 'Melodie',
        es: 'Melodías',
        pl: 'Melodie',
        uk: 'Мелодії',
        'zh-cn': '旋律',
    };

    // no playback state available
    protected readonly currentStateId = null;
    protected readonly currentStateName: ioBroker.StringOrTranslated = '';
    protected readonly stopStateName: ioBroker.StringOrTranslated = {
        en: 'Stop melody',
        de: 'Melodie stoppen',
        ru: 'Остановить мелодию',
        pt: 'Parar melodia',
        nl: 'Melodie stoppen',
        fr: 'Arrêter la mélodie',
        it: 'Ferma melodia',
        es: 'Detener melodía',
        pl: 'Zatrzymaj melodię',
        uk: 'Зупинити мелодію',
        'zh-cn': '停止旋律',
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected async loadItems(audioState: AudioState): Promise<Array<MelodyItem>> {
        const melodyList = await this.apiClient.audio.listMelodies();

        // Invalid melodies (RTTTL does not parse) cannot be played
        for (const melody of melodyList.melodies.filter(m => !m.valid)) {
            this.adapter.log.debug(`[${this.channel}] Skipping invalid melody "${melody.name}": ${melody.error}`);
        }

        return melodyList.melodies.filter(m => m.valid);
    }

    protected async play(name: string): Promise<void> {
        await this.apiClient.audio.play({ melody: name });
    }

    protected async stop(): Promise<void> {
        await this.apiClient.audio.stop('sounds');
    }

    protected override async createItemExtraObjects(nameClean: string, item: MelodyItem): Promise<void> {
        await this.adapter.extendObject(`${this.channel}.${nameClean}.rtttl`, {
            type: 'state',
            common: {
                name: 'RTTTL',
                type: 'string',
                role: 'text',
                read: true,
                write: false,
            },
            native: {},
        });

        await this.adapter.extendObject(`${this.channel}.${nameClean}.duration`, {
            type: 'state',
            common: {
                name: {
                    en: 'Duration',
                    de: 'Dauer',
                    ru: 'Продолжительность',
                    pt: 'Duração',
                    nl: 'Duur',
                    fr: 'Durée',
                    it: 'Durata',
                    es: 'Duración',
                    pl: 'Czas trwania',
                    uk: 'Тривалість',
                    'zh-cn': '时长',
                },
                type: 'number',
                role: 'value',
                unit: 'ms',
                read: true,
                write: false,
            },
            native: {},
        });

        await this.adapter.setStateChangedAsync(`${this.channel}.${nameClean}.rtttl`, { val: item.rtttl, ack: true });
        await this.adapter.setStateChangedAsync(`${this.channel}.${nameClean}.duration`, {
            val: item.durationMs,
            ack: true,
        });
    }
}
