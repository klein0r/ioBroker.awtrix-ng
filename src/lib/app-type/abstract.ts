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

            if (this.adapter.isMainInstance()) {
                this.objPrefix = this.adapter.namespace;
            } else {
                this.objPrefix = this.adapter.config.foreignSettingsInstance;
            }

            adapter.on('stateChange', this.onStateChange.bind(this));
            adapter.on('objectChange', this.onObjectChange.bind(this));
        }

        public async init(appInfo?: AppInfo): Promise<void> {
            const appNameC = this.getNameClean();

            const appEnabledState = await this.adapter.getForeignStateAsync(
                `${this.objPrefix}.apps.${appNameC}.enabled`,
            );
            const appSlotState = await this.adapter.getForeignStateAsync(`${this.objPrefix}.apps.${appNameC}.slot`);

            if (appInfo && appInfo.origin !== 'module') {
                this.isEnabled = appInfo.enabled ?? true;
                this.slot = appInfo.slot ?? null;
            } else {
                this.isEnabled =
                    appEnabledState && typeof appEnabledState?.val === 'boolean' ? !!appEnabledState.val : true;
                this.slot = appSlotState && typeof appSlotState?.val === 'number' ? appSlotState.val : null;
            }

            // Ack if changed while instance was stopped
            if (!appEnabledState || !appEnabledState?.ack || appEnabledState?.val !== this.isEnabled) {
                await this.adapter.setState(`apps.${appNameC}.enabled`, {
                    val: this.isEnabled,
                    ack: true,
                    c: 'init',
                });
            }

            if (!appSlotState || !appSlotState?.ack || appSlotState?.val !== this.slot) {
                await this.adapter.setState(`apps.${appNameC}.slot`, { val: this.slot, ack: true, c: 'init' });
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
            // Handle all states for user apps
            if (id && state && !state.ack) {
                const appName = this.getName();
                const appNameC = this.getNameClean();

                const idOwnNamespace = this.getObjIdOwnNamespace(id);

                if (id === `${this.objPrefix}.apps.${appNameC}.enabled`) {
                    if (state.val !== this.isEnabled) {
                        this.adapter.log.debug(
                            `[onStateChange] ${appName}: Enabled of app ${appName} changed to ${state.val}`,
                        );

                        this.isEnabled = !!state.val;
                        await this.adapter.refreshAppOrder();

                        await this.adapter.setState(idOwnNamespace, {
                            val: state.val,
                            ack: true,
                            c: `onStateChange ${this.objPrefix}`,
                        });
                    } else {
                        this.adapter.log.debug(
                            `[onStateChange] ${appName}: Enabled of app "${appName}" IGNORED (not changed): ${state.val}`,
                        );

                        await this.adapter.setState(idOwnNamespace, {
                            val: state.val,
                            ack: true,
                            c: `onStateChange ${this.objPrefix} (unchanged)`,
                        });
                    }
                } else if (id === `${this.objPrefix}.apps.${appNameC}.slot` && typeof state.val === 'number') {
                    if (state.val !== this.slot) {
                        this.adapter.log.debug(
                            `[onStateChange] ${appName}: Slot of app ${appName} changed to ${state.val}`,
                        );

                        this.slot = state.val;
                        await this.adapter.refreshAppOrder();

                        await this.adapter.setState(idOwnNamespace, {
                            val: state.val,
                            ack: true,
                            c: `onStateChange ${this.objPrefix}`,
                        });
                    } else {
                        this.adapter.log.debug(
                            `[onStateChange] ${appName}: Slot of app "${appName}" IGNORED (not changed): ${state.val}`,
                        );

                        await this.adapter.setState(idOwnNamespace, {
                            val: state.val,
                            ack: true,
                            c: `onStateChange ${this.objPrefix} (unchanged)`,
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
