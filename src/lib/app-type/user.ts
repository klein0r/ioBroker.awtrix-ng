import type { AwtrixNg } from '../../awtrix-ng';
import type { DefaultApp } from '../adapter-config';
import type { AwtrixApi } from '../api';
import { AppType as AbstractAppType } from './abstract';

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace AppType {
    export abstract class UserApp extends AbstractAppType.AbstractApp {
        private definition: DefaultApp;

        protected ignoreNewValueForAppInTimeRange: number;

        public constructor(apiClient: AwtrixApi.Client, adapter: AwtrixNg, definition: DefaultApp) {
            super(apiClient, adapter, definition.name);

            this.definition = definition;
            this.ignoreNewValueForAppInTimeRange = adapter.config.ignoreNewValueForAppInTimeRange;
        }

        public async unloadAsync(): Promise<void> {
            if (this.adapter.config.removeAppsOnStop) {
                this.adapter.log.info(`[onUnload] Deleting app on awtrix light with name "${this.definition.name}"`);

                try {
                    await this.apiClient.removeAppAsync(this.definition.name).catch(error => {
                        this.adapter.log.warn(`Unable to remove unknown app "${this.definition.name}": ${error}`);
                    });
                } catch (error) {
                    this.adapter.log.error(`[onUnload] Unable to delete app ${this.definition.name}: ${error}`);
                }
            }
        }
    }
}
