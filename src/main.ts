/*
 * Created with @iobroker/create-adapter v2.5.0
 */
import * as utils from '@iobroker/adapter-core';
import { AwtrixNg } from './awtrix-ng';

if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new AwtrixNg(options);
} else {
    // otherwise start the instance directly
    (() => new AwtrixNg())();
}
