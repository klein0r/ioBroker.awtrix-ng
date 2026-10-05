/**
 * Compatibility for sendTo payloads of scripts / Blockly which still use the sound format of firmware 1.1.x.
 * Since firmware 1.2.0 sounds are a stored name or a sound object (file, rtttl, song, speech, track, station + loop).
 */

/** Called once per deprecated key (old key, new format) */
export type DeprecationCallback = (oldKey: string, replacement: string) => void;

type Payload = Record<string, any>;

/**
 * Converts deprecated keys of an app / notification payload: `textCenter` -> `textAlign`
 *
 * @param payload - payload (not modified)
 * @param deprecated - called for every deprecated key
 */
export function migrateAppPayload(payload: Payload, deprecated: DeprecationCallback): Payload {
    const result: Payload = { ...payload };

    if ('textCenter' in result) {
        deprecated('textCenter', "textAlign: 'center' | 'start' | 'end'");
        if (result.textAlign === undefined) {
            result.textAlign = result.textCenter === false ? 'start' : 'center';
        }
        delete result.textCenter;
    }

    return result;
}

/**
 * Converts deprecated keys of a notification payload:
 * - `soundRtttl` / `soundLoop` -> `sound: { rtttl, loop }`
 * - `sound` as number (DFPlayer track) -> `sound: { track }`
 * - `textCenter` -> `textAlign`
 *
 * @param payload - notification payload (not modified)
 * @param deprecated - called for every deprecated key
 */
export function migrateNotificationPayload(payload: Payload, deprecated: DeprecationCallback): Payload {
    const result: Payload = migrateAppPayload(payload, deprecated);

    const loop = result.soundLoop === true;
    if ('soundLoop' in result) {
        deprecated('soundLoop', 'sound: { file: <name>, loop: true }');
        delete result.soundLoop;
    }

    if ('soundRtttl' in result) {
        deprecated('soundRtttl', 'sound: { rtttl: <rtttl> }');
        // soundRtttl won over sound
        result.sound = loop ? { rtttl: result.soundRtttl, loop } : { rtttl: result.soundRtttl };
        delete result.soundRtttl;
    } else if (typeof result.sound === 'number') {
        deprecated('sound (number)', 'sound: { track: <number> }');
        result.sound = loop ? { track: result.sound, loop } : { track: result.sound };
    } else if (typeof result.sound === 'string' && loop) {
        result.sound = { file: result.sound, loop };
    }

    return result;
}

/**
 * Converts deprecated sources of an audio request (sendTo "audio") into a sound object:
 * - `sound` / `mp3` / `melody` / `sfx` -> `file` (with `script`: `file: "<script>/<name>"`)
 * - `loop: <name>` -> `file: <name>, loop: true`
 * - `fx` -> `song`, `index` -> `station`, `url` (radio stream) -> `station`
 *
 * @param request - audio request (not modified)
 * @param deprecated - called for every deprecated key
 */
export function migrateAudioRequest(request: Payload, deprecated: DeprecationCallback): Payload {
    const result: Payload = { ...request };

    const script = typeof result.script === 'string' ? result.script : undefined;
    if ('script' in result) {
        deprecated('script', 'file: "<script>/<name>"');
        delete result.script;
    }

    const toFile = (name: string): string => (script ? `${script}/${name}` : name);

    for (const key of ['sound', 'mp3', 'melody', 'sfx']) {
        if (typeof result[key] === 'string') {
            deprecated(key, 'file: <name>');
            result.file = toFile(result[key]);
            delete result[key];
        }
    }

    // loop was the name of a looping MP3 - now a boolean
    if (typeof result.loop === 'string') {
        deprecated('loop (name)', 'file: <name>, loop: true');
        result.file = toFile(result.loop);
        result.loop = true;
    }

    if (typeof result.fx === 'string') {
        deprecated('fx', 'song: <song>');
        result.song = result.fx;
        delete result.fx;
    }

    if (typeof result.index === 'number') {
        deprecated('index', 'station: <number>');
        result.station = result.index;
        delete result.index;
    }

    // url was a radio stream played without storing it
    if (typeof result.url === 'string') {
        deprecated('url', 'station: <url>');
        result.station = result.url;
        delete result.url;
    }

    return result;
}
