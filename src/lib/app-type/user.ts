import type { AwtrixClient, ClassicAppPayload } from 'awtrix-ng-api';
import type { AwtrixNg } from '../../awtrix-ng';
import type { DefaultApp } from '../adapter-config';
import { AppType as AbstractAppType } from './abstract';

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace AppType {
    export abstract class UserApp extends AbstractAppType.AbstractApp {
        private definition: DefaultApp;

        protected ignoreNewValueForAppInTimeRange: number;
        private keepAliveTimeout: ioBroker.Timeout | undefined;

        /** Interval to transfer the app again (if a lifetime is used) */
        private static readonly KEEP_ALIVE_INTERVAL_MS = 5 * 60 * 1000;

        public constructor(apiClient: AwtrixClient, adapter: AwtrixNg, definition: DefaultApp) {
            super(apiClient, adapter, definition.name);

            this.definition = definition;
            this.ignoreNewValueForAppInTimeRange = Math.min(adapter.config.ignoreNewValueForAppInTimeRange, 10);
            this.keepAliveTimeout = undefined;
        }

        /**
         * Apps get a lifetime if they should be removed when the instance is stopped. So they
         * disappear from the device if the adapter is not running anymore (e.g. after a crash).
         */
        protected useLifetime(): boolean {
            return !!this.adapter.config.removeAppsOnStop;
        }

        /**
         * Lifetime options for the app payload (just if lifetime is used)
         */
        protected getLifetimeOptions(): Pick<ClassicAppPayload, 'lifetimeMs'> {
            if (this.useLifetime()) {
                return { lifetimeMs: UserApp.KEEP_ALIVE_INTERVAL_MS + 60 * 1000 }; // interval + buffer
            }

            return {};
        }

        /**
         * Transfers the app again before the lifetime ends (even if the value did not change)
         */
        protected scheduleKeepAlive(): void {
            if (!this.useLifetime()) {
                return;
            }

            this.clearKeepAlive();
            this.keepAliveTimeout = this.adapter.setTimeout(async () => {
                this.keepAliveTimeout = undefined;

                if (this.adapter.isApiConnected()) {
                    this.adapter.log.debug(`[keepAlive] Transferring app "${this.getName()}" again`);
                    await this.refresh();
                } else {
                    this.scheduleKeepAlive();
                }
            }, UserApp.KEEP_ALIVE_INTERVAL_MS);
        }

        private clearKeepAlive(): void {
            if (this.keepAliveTimeout) {
                this.adapter.clearTimeout(this.keepAliveTimeout);
                this.keepAliveTimeout = undefined;
            }
        }

        public async unloadAsync(): Promise<void> {
            this.clearKeepAlive();

            if (this.adapter.config.removeAppsOnStop) {
                this.adapter.log.info(`[onUnload] Deleting app on awtrix light with name "${this.definition.name}"`);

                await this.removeApp('instance stopped');
            }
        }
    }
}
