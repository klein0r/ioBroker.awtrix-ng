import type { AudioState } from 'awtrix-ng-api';
import { AudioPlayer, type PlayerItem } from './player';

type Mp3File = PlayerItem & {
    /** file name (with .mp3) */
    file: string;
    /** size in bytes */
    size: number;
};

/**
 * MP3 files stored on the device (e.g. Ulanzi TC002): one channel per file under audio.mp3.<file>.
 * The files are uploaded / deleted in the web interface of the device - ioBroker just plays them.
 */
export class Mp3 extends AudioPlayer<Mp3File> {
    protected readonly channel = 'audio.mp3';
    protected readonly channelName: ioBroker.StringOrTranslated = {
        en: 'MP3 files',
        de: 'MP3-Dateien',
        ru: 'MP3-файлы',
        pt: 'Ficheiros MP3',
        nl: 'MP3-bestanden',
        fr: 'Fichiers MP3',
        it: 'File MP3',
        es: 'Archivos MP3',
        pl: 'Pliki MP3',
        uk: 'MP3-файли',
        'zh-cn': 'MP3 文件',
    };

    protected readonly currentStateId = 'file';
    protected readonly currentStateName: ioBroker.StringOrTranslated = {
        en: 'Current file',
        de: 'Aktuelle Datei',
        ru: 'Текущий файл',
        pt: 'Ficheiro atual',
        nl: 'Huidig bestand',
        fr: 'Fichier actuel',
        it: 'File attuale',
        es: 'Archivo actual',
        pl: 'Aktualny plik',
        uk: 'Поточний файл',
        'zh-cn': '当前文件',
    };
    protected readonly stopStateName: ioBroker.StringOrTranslated = {
        en: 'Stop MP3',
        de: 'MP3 stoppen',
        ru: 'Остановить MP3',
        pt: 'Parar MP3',
        nl: 'MP3 stoppen',
        fr: 'Arrêter le MP3',
        it: 'Ferma MP3',
        es: 'Detener MP3',
        pl: 'Zatrzymaj MP3',
        uk: 'Зупинити MP3',
        'zh-cn': '停止 MP3',
    };

    // Files are short - the playing state changes without any action
    protected override readonly followPlayback = true;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected async loadItems(audioState: AudioState): Promise<Array<Mp3File>> {
        const mp3List = await this.apiClient.audio.listMp3();

        // Just files in /MP3 (sounds of scripts belong to the scripts)
        return mp3List.files.map(f => ({
            name: f.name.replace(/\.mp3$/i, ''), // played (and reported) without extension
            file: f.name,
            size: f.size,
        }));
    }

    protected override getPlaying(audioState: AudioState): string | null {
        // files of scripts are not listed
        return audioState.mp3.playing && !audioState.mp3.script ? audioState.mp3.name : null;
    }

    protected override setPlaying(audioState: AudioState, name: string | null): void {
        audioState.mp3.playing = name !== null;
        audioState.mp3.name = name ?? '';
        audioState.mp3.script = '';
    }

    protected async play(name: string): Promise<void> {
        await this.apiClient.audio.play({ mp3: name });
    }

    protected async stop(): Promise<void> {
        await this.apiClient.audio.stop('sounds');
    }

    protected override async createItemExtraObjects(nameClean: string, item: Mp3File): Promise<void> {
        await this.adapter.extendObject(`${this.channel}.${nameClean}.size`, {
            type: 'state',
            common: {
                name: {
                    en: 'File size',
                    de: 'Dateigröße',
                    ru: 'Размер файла',
                    pt: 'Tamanho do ficheiro',
                    nl: 'Bestandsgrootte',
                    fr: 'Taille du fichier',
                    it: 'Dimensione del file',
                    es: 'Tamaño del archivo',
                    pl: 'Rozmiar pliku',
                    uk: 'Розмір файлу',
                    'zh-cn': '文件大小',
                },
                type: 'number',
                role: 'value',
                unit: 'bytes',
                read: true,
                write: false,
            },
            native: {},
        });

        await this.adapter.setStateChangedAsync(`${this.channel}.${nameClean}.size`, { val: item.size, ack: true });
    }
}
