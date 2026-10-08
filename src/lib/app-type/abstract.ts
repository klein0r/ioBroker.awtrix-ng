import type { AwtrixNg } from '../../awtrix-ng';
import type { AppInfo, AwtrixClient, ClassicAppPayload } from 'awtrix-ng-api';

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace AppType {
    export abstract class AbstractApp {
        private name: string;
        private nameClean: string;

        protected apiClient: AwtrixClient;
        protected adapter: AwtrixNg;

        protected objPrefix: string;
        protected isEnabled: boolean;
        protected slot: number | null;
        private deviceSlot: number | null;

        private readonly stateChangeHandler: (id: string, state: ioBroker.State | null | undefined) => Promise<void>;
        private readonly objectChangeHandler: (id: string, obj: ioBroker.Object | null | undefined) => Promise<void>;

        public constructor(apiClient: AwtrixClient, adapter: AwtrixNg, name: string) {
            this.apiClient = apiClient;
            this.adapter = adapter;

            this.name = name;
            this.nameClean = name
                .replace(this.adapter.FORBIDDEN_CHARS, '_')
                .replace(/[.\s/]+/g, '_')
                .replace(/_{2,}/g, '_')
                .replace(/^_+|_+$/g, '');

            this.isEnabled = false;
            this.slot = null;
            this.deviceSlot = null;

            if (this.adapter.isMainInstance()) {
                this.objPrefix = this.adapter.namespace;
            } else {
                this.objPrefix = this.adapter.config.foreignSettingsInstance;
            }

            this.stateChangeHandler = this.onStateChange.bind(this);
            this.objectChangeHandler = this.onObjectChange.bind(this);

            adapter.on('stateChange', this.stateChangeHandler);
            adapter.on('objectChange', this.objectChangeHandler);
        }

        /**
         * Stops all timers and event listeners of this app (e.g. instance stopped or app removed from device).
         *
         * @param removeFromDevice - remove the app from the device (if configured and supported by the app type)
         */
        // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
        public async unloadAsync(removeFromDevice: boolean): Promise<void> {
            this.adapter.removeListener('stateChange', this.stateChangeHandler);
            this.adapter.removeListener('objectChange', this.objectChangeHandler);
        }

        public async init(appInfo?: AppInfo): Promise<void> {
            const appNameC = this.getNameClean();

            const appEnabledState = await this.adapter.getForeignStateAsync(
                `${this.objPrefix}.apps.${appNameC}.enabled`,
            );
            const appSlotState = await this.adapter.getForeignStateAsync(`${this.objPrefix}.apps.${appNameC}.slot`);

            const appInfoDevice = appInfo && appInfo.origin !== 'module' ? appInfo : undefined;

            // ioBroker is leading - the values of the device are just used for new apps (no state value yet)
            if (appEnabledState && typeof appEnabledState.val === 'boolean') {
                this.isEnabled = appEnabledState.val;
            } else {
                this.isEnabled = appInfoDevice?.enabled ?? true;
            }

            // Missing slots are assigned by the adapter (see AwtrixNg.normalizeAppOrder)
            this.slot = appSlotState && typeof appSlotState.val === 'number' ? appSlotState.val : null;
            this.deviceSlot = appInfoDevice?.slot ?? null;

            // Ack if changed while instance was stopped
            if (!appEnabledState || !appEnabledState?.ack || appEnabledState?.val !== this.isEnabled) {
                await this.adapter.setState(`apps.${appNameC}.enabled`, {
                    val: this.isEnabled,
                    ack: true,
                    c: 'init',
                });
            }

            await this.setAppStatus(appInfo?.present ?? false);
        }

        /**
         * Updates the status states of the app (own namespace - status of this device).
         *
         * @param present - app exists on the device (undefined = unchanged)
         * @param lastError - last error message (null = no error, undefined = unchanged)
         */
        protected async setAppStatus(present?: boolean, lastError?: string | null): Promise<void> {
            const appNameC = this.getNameClean();

            try {
                if (present !== undefined) {
                    await this.adapter.setStateChangedAsync(`apps.${appNameC}.present`, { val: present, ack: true });
                }
                if (lastError !== undefined) {
                    await this.adapter.setStateChangedAsync(`apps.${appNameC}.lastError`, {
                        val: lastError,
                        ack: true,
                    });
                }
            } catch (error) {
                this.adapter.log.debug(`[setAppStatus] Unable to update status of app "${this.getName()}": ${error}`);
            }
        }

        /**
         * Creates or replaces the app on the device (pushed app) and updates the status states.
         *
         * @param payload - app definition
         * @param context - description for log messages
         */
        protected async pushApp(payload: ClassicAppPayload, context: string): Promise<boolean> {
            const appName = this.getName();

            try {
                await this.apiClient.apps.push(appName, payload);
                await this.setAppStatus(true, null);

                return true;
            } catch (error) {
                this.adapter.log.warn(`[pushApp] Unable to update app "${appName}" (${context}): ${error}`);
                await this.setAppStatus(undefined, error instanceof Error ? error.message : String(error));

                return false;
            }
        }

        /**
         * Removes the app from the device and updates the status states.
         *
         * @param context - description for log messages
         */
        protected async removeApp(context: string): Promise<boolean> {
            const appName = this.getName();

            this.adapter.log.debug(`[removeApp] Going to remove app "${appName}" (${context})`);

            try {
                await this.apiClient.apps.delete(appName);
                await this.setAppStatus(false, null);

                return true;
            } catch (error) {
                this.adapter.log.warn(`[removeApp] Unable to remove app "${appName}" (${context}): ${error}`);
                await this.setAppStatus(undefined, error instanceof Error ? error.message : String(error));

                return false;
            }
        }

        // eslint-disable-next-line @typescript-eslint/require-await
        public async refresh(): Promise<boolean> {
            return true;
        }

        public abstract getDescription(): string;

        public abstract getIconForObjectTree(): string;

        public getName(): string {
            return this.name;
        }

        public getNameClean(): string {
            return this.nameClean;
        }

        public enabled(): boolean {
            return this.isEnabled;
        }

        public getSlot(): number | null {
            return this.slot;
        }

        /**
         * Position of the app on the device (when it was initialized) - used to sort new apps
         */
        public getDeviceSlot(): number | null {
            return this.deviceSlot;
        }

        /**
         * Sets the position of the app - just called by the adapter, which keeps all slots dense (0 ... n-1)
         *
         * @param slot - new position
         */
        public setSlot(slot: number | null): void {
            this.slot = slot;
        }

        public isMainInstance(): boolean {
            return this.adapter.isMainInstance();
        }

        protected getObjIdOwnNamespace(id: string): string {
            return this.adapter.removeNamespace(
                this.isMainInstance() ? id : id.replace(this.objPrefix, this.adapter.namespace),
            );
        }

        private hasOwnActivateState(): boolean {
            return this.isMainInstance() || !this.adapter.config.foreignSettingsInstanceActivateApps;
        }

        public async createObjects(): Promise<void> {
            const appName = this.getName();
            const appNameC = this.getNameClean();

            this.adapter.log.debug(
                `[createObjects] Creating objects for app "${appName}" (${this.isMainInstance() ? 'main' : this.objPrefix})`,
            );

            await this.adapter.extendObject(`apps.${appNameC}.enabled`, {
                type: 'state',
                common: {
                    name: {
                        en: 'Enabled',
                        de: 'Aktiviert',
                        ru: 'Включено',
                        pt: 'Ativado',
                        nl: 'Ingeschakeld',
                        fr: 'Activé',
                        it: 'Abilitato',
                        es: 'Activado',
                        pl: 'Włączone',
                        uk: 'Увімкнено',
                        'zh-cn': '已啟用',
                    },
                    type: 'boolean',
                    role: 'switch.enable',
                    read: true,
                    write: this.isMainInstance(),
                    def: true,
                },
                native: {},
            });

            await this.adapter.extendObject(`apps.${appNameC}.slot`, {
                type: 'state',
                common: {
                    name: {
                        en: 'Position in loop',
                        de: 'Position in der Schleife',
                        ru: 'Позиция в цикле',
                        pt: 'Posição no ciclo',
                        nl: 'Positie in de lus',
                        fr: 'Position dans la boucle',
                        it: 'Posizione nel ciclo',
                        es: 'Posición en el bucle',
                        pl: 'Pozycja w pętli',
                        uk: 'Позиція в циклі',
                        'zh-cn': 'Position in loop',
                    },
                    type: 'number',
                    role: 'level',
                    read: true,
                    write: this.isMainInstance(),
                },
                native: {},
            });

            await this.adapter.extendObject(`apps.${appNameC}.present`, {
                type: 'state',
                common: {
                    name: {
                        en: 'Present on device',
                        de: 'Auf dem Gerät vorhanden',
                        ru: 'Присутствует на устройстве',
                        pt: 'Presente no dispositivo',
                        nl: 'Aanwezig op apparaat',
                        fr: "Présent sur l'appareil",
                        it: 'Presente sul dispositivo',
                        es: 'Presente en el dispositivo',
                        pl: 'Obecna na urządzeniu',
                        uk: 'Присутній на пристрої',
                        'zh-cn': '存在于设备上',
                    },
                    type: 'boolean',
                    role: 'indicator',
                    read: true,
                    write: false,
                    def: false,
                },
                native: {},
            });

            await this.adapter.extendObject(`apps.${appNameC}.lastError`, {
                type: 'state',
                common: {
                    name: {
                        en: 'Last error',
                        de: 'Letzter Fehler',
                        ru: 'Последняя ошибка',
                        pt: 'Último erro',
                        nl: 'Laatste fout',
                        fr: 'Dernière erreur',
                        it: 'Ultimo errore',
                        es: 'Último error',
                        pl: 'Ostatni błąd',
                        uk: 'Остання помилка',
                        'zh-cn': '最后一个错误',
                    },
                    type: 'string',
                    role: 'text',
                    read: true,
                    write: false,
                },
                native: {},
            });

            if (!this.isMainInstance()) {
                await this.adapter.subscribeForeignStatesAsync(`${this.objPrefix}.apps.${appNameC}.enabled`);
                await this.adapter.subscribeForeignStatesAsync(`${this.objPrefix}.apps.${appNameC}.slot`);
            }

            if (this.hasOwnActivateState()) {
                await this.adapter.extendObject(`apps.${appNameC}.activate`, {
                    type: 'state',
                    common: {
                        name: {
                            en: 'Activate',
                            de: 'Aktivieren',
                            ru: 'Активировать',
                            pt: 'Ativar',
                            nl: 'Activeren',
                            fr: 'Activer',
                            it: 'Attivare',
                            es: 'Activar',
                            pl: 'Aktywuj',
                            uk: 'Активувати',
                            'zh-cn': '启用',
                        },
                        type: 'boolean',
                        role: 'button',
                        read: false,
                        write: true,
                    },
                    native: {},
                });
            } else {
                await this.adapter.delObjectAsync(`apps.${appNameC}.activate`);
                await this.adapter.subscribeForeignStatesAsync(`${this.objPrefix}.apps.${appNameC}.activate`);
            }
        }

        private async onStateChange(id: string, state: ioBroker.State | null | undefined): Promise<void> {
            const appName = this.getName();
            const appNameC = this.getNameClean();

            if (id) {
                // Handle default states for all apps
                if (state && !state.ack) {
                    // activate app
                    if (
                        id ===
                        `${this.hasOwnActivateState() ? this.adapter.namespace : this.objPrefix}.apps.${appNameC}.activate`
                    ) {
                        if (state.val) {
                            if (this.isEnabled) {
                                this.apiClient.apps
                                    .switchTo(appName)
                                    .then(async () => {
                                        const idOwnNamespace = this.getObjIdOwnNamespace(id);
                                        await this.adapter.setState(idOwnNamespace, { val: state.val, ack: true });
                                    })
                                    .catch(error => {
                                        this.adapter.log.warn(
                                            `[onStateChange] ${appName}: (apps/activate) Unable to execute action: ${error}`,
                                        );
                                    });
                            } else {
                                this.adapter.log.warn(
                                    `[onStateChange] ${appName}: App is not enabled - unable to activate`,
                                );
                            }
                        } else {
                            this.adapter.log.warn(`[onStateChange] ${appName}: Received invalid value for state ${id}`);
                        }
                    }
                }
            }

            await this.stateChanged(id, state);
        }

        protected async stateChanged(id: string, state: ioBroker.State | null | undefined): Promise<void> {
            // Slot changed in the main instance (moves of other apps are acknowledged) - follow the order of the main instance
            if (id && state && !this.isMainInstance() && id === `${this.objPrefix}.apps.${this.getNameClean()}.slot`) {
                this.adapter.scheduleAppOrderSync();
                return;
            }

            // Handle all states for user apps
            if (id && state && !state.ack) {
                const appName = this.getName();
                const appNameC = this.getNameClean();

                const idOwnNamespace = this.getObjIdOwnNamespace(id);

                if (id === `${this.objPrefix}.apps.${appNameC}.enabled`) {
                    const enabled = !!state.val;

                    this.adapter.log.debug(`[onStateChange] ${appName}: Enabled of app changed to ${enabled}`);

                    // Switches just this app on or off - it keeps its place in the order
                    await this.apiClient.apps
                        .setEnabled(appName, enabled)
                        .then(async () => {
                            this.isEnabled = enabled;

                            await this.adapter.setState(idOwnNamespace, {
                                val: enabled,
                                ack: true,
                                c: `onStateChange ${this.objPrefix}`,
                            });
                        })
                        .catch(error => {
                            this.adapter.log.warn(
                                `[onStateChange] ${appName}: Unable to change enabled state of app: ${error}`,
                            );
                        });
                } else if (id === `${this.objPrefix}.apps.${appNameC}.slot`) {
                    // Main instance: move app to the given position (other apps are shifted)
                    if (typeof state.val === 'number' && Number.isFinite(state.val)) {
                        this.adapter.log.debug(`[onStateChange] ${appName}: Moving app to position ${state.val}`);

                        await this.adapter.moveApp(this, state.val);
                    } else {
                        this.adapter.log.warn(
                            `[onStateChange] ${appName}: Invalid position "${state.val}" - expected a number`,
                        );

                        await this.adapter.setState(idOwnNamespace, {
                            val: this.slot,
                            ack: true,
                            c: 'invalid value',
                        });
                    }
                }
            }
        }

        private async onObjectChange(id: string, obj: ioBroker.Object | null | undefined): Promise<void> {
            await this.objectChanged(id, obj);
        }

        /* eslint-disable @typescript-eslint/no-unused-vars */
        protected async objectChanged(id: string, obj: ioBroker.Object | null | undefined): Promise<void> {
            // override
        }
    }
}
