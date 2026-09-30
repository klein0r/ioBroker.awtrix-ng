import type { AppInfo, AwtrixClient, ClassicAppPayload } from 'awtrix-ng-api';
import type { AwtrixNg } from '../../../awtrix-ng';
import type { HistoryApp } from '../../adapter-config';
import { AppType as UserAppType } from '../user';

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace AppType {
    export type HistoryOptions = {
        start: number;
        end: number;
        limit: number;
        aggregate?: 'none' | 'average' | 'min' | 'max' | 'count';
        step?: number;
        returnNewestEntries: boolean;
        ignoreNull: number;
        removeBorderValues: boolean;
        ack: boolean;
    };

    export class History extends UserAppType.UserApp {
        private appDefinition: HistoryApp;
        private isValidSourceInstance: boolean;
        private isValidObjId: boolean;
        private refreshTimeout: ioBroker.Timeout | undefined;

        public constructor(apiClient: AwtrixClient, adapter: AwtrixNg, definition: HistoryApp) {
            super(apiClient, adapter, definition);

            this.appDefinition = definition;
            this.isValidSourceInstance = false;
            this.isValidObjId = false;
            this.refreshTimeout = undefined;
        }

        public override getDescription(): string {
            return 'history';
        }

        public override getIconForObjectTree(): string {
            return 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0NDggNTEyIj48IS0tIUZvbnQgQXdlc29tZSBGcmVlIDYuNy4yIGJ5IEBmb250YXdlc29tZSAtIGh0dHBzOi8vZm9udGF3ZXNvbWUuY29tIExpY2Vuc2UgLSBodHRwczovL2ZvbnRhd2Vzb21lLmNvbS9saWNlbnNlL2ZyZWUgQ29weXJpZ2h0IDIwMjUgRm9udGljb25zLCBJbmMuLS0+PHBhdGggZD0iTTE2MCA4MGMwLTI2LjUgMjEuNS00OCA0OC00OGwzMiAwYzI2LjUgMCA0OCAyMS41IDQ4IDQ4bDAgMzUyYzAgMjYuNS0yMS41IDQ4LTQ4IDQ4bC0zMiAwYy0yNi41IDAtNDgtMjEuNS00OC00OGwwLTM1MnpNMCAyNzJjMC0yNi41IDIxLjUtNDggNDgtNDhsMzIgMGMyNi41IDAgNDggMjEuNSA0OCA0OGwwIDE2MGMwIDI2LjUtMjEuNSA0OC00OCA0OGwtMzIgMGMtMjYuNSAwLTQ4LTIxLjUtNDgtNDhMMCAyNzJ6TTM2OCA5NmwzMiAwYzI2LjUgMCA0OCAyMS41IDQ4IDQ4bDAgMjg4YzAgMjYuNS0yMS41IDQ4LTQ4IDQ4bC0zMiAwYy0yNi41IDAtNDgtMjEuNS00OC00OGwwLTI4OGMwLTI2LjUgMjEuNS00OCA0OC00OHoiLz48L3N2Zz4=';
        }

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        public override async init(appInfo?: AppInfo): Promise<void> {
            await this.validateSource(true);

            await super.init();
        }

        /**
         * Checks if the source instance is running and if logging is configured for objId.
         * Warnings are just logged on init - later checks (on every refresh while invalid) log as debug.
         */
        private async validateSource(isInit: boolean): Promise<void> {
            const logWarn = (msg: string): void => (isInit ? this.adapter.log.warn(msg) : this.adapter.log.debug(msg));
            const logInfo = (msg: string): void => (isInit ? this.adapter.log.info(msg) : this.adapter.log.debug(msg));

            this.isValidSourceInstance = false;
            this.isValidObjId = false;

            try {
                if (this.appDefinition.sourceInstance) {
                    const sourceInstanceObj = await this.adapter.getForeignObjectAsync(
                        `system.adapter.${this.appDefinition.sourceInstance}`,
                    );

                    if (sourceInstanceObj && sourceInstanceObj.common?.getHistory) {
                        const sourceInstanceAliveState = await this.adapter.getForeignStateAsync(
                            `system.adapter.${this.appDefinition.sourceInstance}.alive`,
                        );

                        if (sourceInstanceAliveState && sourceInstanceAliveState.val) {
                            this.adapter.log.debug(
                                `[initHistoryApp] Found valid source instance for history data: ${this.appDefinition.sourceInstance}`,
                            );

                            this.isValidSourceInstance = true;
                        } else {
                            logWarn(
                                `[initHistoryApp] Unable to get history data of "${this.appDefinition.sourceInstance}": instance not running (stopped)`,
                            );
                        }
                    } else {
                        logWarn(
                            `[initHistoryApp] Unable to get history data of "${this.appDefinition.sourceInstance}": no valid source for getHistory()`,
                        );
                    }
                }

                if (this.appDefinition.objId) {
                    this.adapter.log.debug(
                        `[initHistoryApp] getting history data for app "${this.appDefinition.name}" of "${this.appDefinition.objId}" from ${this.appDefinition.sourceInstance}`,
                    );

                    if (this.isValidSourceInstance) {
                        const sourceObj = await this.adapter.getForeignObjectAsync(this.appDefinition.objId);

                        if (
                            sourceObj &&
                            Object.prototype.hasOwnProperty.call(
                                sourceObj?.common?.custom ?? {},
                                this.appDefinition.sourceInstance,
                            )
                        ) {
                            this.isValidObjId = true;
                        } else {
                            logInfo(
                                `[initHistoryApp] Unable to get data for app "${this.appDefinition.name}" of "${this.appDefinition.objId}": logging is not configured for this object`,
                            );
                        }
                    } else {
                        logInfo(
                            `[initHistoryApp] Unable to get data for app "${this.appDefinition.name}" of "${this.appDefinition.objId}": source invalid or unavailable`,
                        );
                    }
                }
            } catch (error) {
                this.adapter.log.error(
                    `[initHistoryApp] Unable to get data for app "${this.appDefinition.name}" of "${this.appDefinition.objId}": ${error}`,
                );
            }
        }

        public override async refresh(): Promise<boolean> {
            let refreshed = false;

            try {
                if (await super.refresh()) {
                    // e.g. history instance was stopped on init - check again
                    if (!this.isValidSourceInstance || !this.isValidObjId) {
                        await this.validateSource(false);
                    }

                    if (this.isValidSourceInstance && this.isValidObjId) {
                        refreshed = await this.refreshHistoryData();
                    }
                }
            } catch (error) {
                this.adapter.log.warn(
                    `[refreshHistoryApp] Unable to refresh app "${this.appDefinition.name}": ${error}`,
                );
            }

            // Always schedule the next refresh (even after errors)
            this.adapter.log.debug(
                `re-creating history apps timeout (${this.adapter.config.historyAppsRefreshInterval ?? 300} seconds)`,
            );
            this.refreshTimeout =
                this.refreshTimeout ||
                this.adapter.setTimeout(
                    async () => {
                        this.refreshTimeout = undefined;
                        await this.refresh();
                    },
                    this.adapter.config.historyAppsRefreshInterval * 1000 || 5 * 60 * 1000,
                );

            return refreshed;
        }

        private async refreshHistoryData(): Promise<boolean> {
            const itemCount = this.appDefinition.icon ? 11 : 16; // can display 11 values with icon or 16 values without icon

            const options: HistoryOptions = {
                start: 1,
                end: Date.now(),
                limit: itemCount,
                returnNewestEntries: true,
                ignoreNull: 0,
                removeBorderValues: true,
                ack: true,
            };

            if (this.appDefinition.mode == 'aggregate') {
                options.aggregate = this.appDefinition.aggregation;
                options.step = this.appDefinition.step ? this.appDefinition.step * 1_000 : 3_600_000;
            } else {
                // mode = last
                options.aggregate = 'none';
            }

            this.adapter.log.debug(
                `[refreshHistoryApp] Getting history for app "${this.appDefinition.name}" of "${this.appDefinition.objId}" with options: ${JSON.stringify(options)}`,
            );

            const historyData = await this.adapter.sendToAsync(
                this.appDefinition.sourceInstance,
                'getHistory',
                {
                    id: this.appDefinition.objId,
                    options,
                },
                { timeout: 30_000 },
            );

            const result = (historyData as { result?: Array<ioBroker.State> } | undefined)?.result;
            const graphData = (Array.isArray(result) ? result : [])
                .filter(state => typeof state?.val === 'number' && state.ack)
                .map(state => Math.round(state.val as number))
                .slice(itemCount * -1);

            this.adapter.log.debug(
                `[refreshHistoryApp] Data for app "${this.appDefinition.name}" of "${this.appDefinition.objId}": ${JSON.stringify(historyData)} - filtered: ${JSON.stringify(graphData)}`,
            );

            if (graphData.length > 0) {
                const moreOptions: ClassicAppPayload = {};

                // Duration
                if (this.appDefinition.durationMs > 0) {
                    moreOptions.durationMs = this.appDefinition.durationMs;
                }

                // Repeat
                if (this.appDefinition.repeat > 0) {
                    moreOptions.repeat = this.appDefinition.repeat;
                }

                // Bar or line graph
                if (this.appDefinition.display == 'bar') {
                    moreOptions.barChart = graphData;
                } else {
                    moreOptions.lineChart = graphData;
                }

                await this.pushApp(
                    {
                        chartColor: this.appDefinition.lineColor || '#FF0000',
                        backgroundColor: this.appDefinition.backgroundColor || '#000000',
                        chartAutoscale: true,
                        icon: this.appDefinition.icon,
                        lifetimeMs: (this.adapter.config.historyAppsRefreshInterval + 60) * 1000, // Remove app if there is no update in configured interval (+ buffer)
                        ...moreOptions,
                    },
                    'history data',
                );

                return true;
            }

            await this.removeApp('no history data');

            return false;
        }

        public override async unloadAsync(removeFromDevice: boolean): Promise<void> {
            if (this.refreshTimeout) {
                this.adapter.log.debug(`clearing history app timeout for "${this.getName()}"`);
                this.adapter.clearTimeout(this.refreshTimeout);
                this.refreshTimeout = undefined;
            }

            await super.unloadAsync(removeFromDevice);
        }
    }
}
