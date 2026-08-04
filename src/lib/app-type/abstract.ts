import type { AwtrixNg } from '../../awtrix-ng';
import type { AwtrixApi } from '../api';

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace AppType {
    export abstract class AbstractApp {
        private name: string;

        protected apiClient: AwtrixApi.Client;
        protected adapter: AwtrixNg;

        protected objPrefix: string;
        protected isEnabled: boolean;
        protected slot: number | null;

        public constructor(apiClient: AwtrixApi.Client, adapter: AwtrixNg, name: string) {
            this.name = name;
            this.isEnabled = false;
            this.slot = null;

            this.apiClient = apiClient;
            this.adapter = adapter;

            if (this.adapter.isMainInstance()) {
                this.objPrefix = this.adapter.namespace;
            } else {
                this.objPrefix = this.adapter.config.foreignSettingsInstance;
            }

            adapter.on('stateChange', this.onStateChange.bind(this));
            adapter.on('objectChange', this.onObjectChange.bind(this));
        }

        public async init(orderDefinition?: AwtrixApi.AppOrderDefinition): Promise<void> {
            const appName = this.getName();
            const appEnabledState = await this.adapter.getForeignStateAsync(
                `${this.objPrefix}.apps.${appName}.enabled`,
            );
            const appSlotState = await this.adapter.getForeignStateAsync(`${this.objPrefix}.apps.${appName}.slot`);

            if (orderDefinition) {
                this.isEnabled = orderDefinition?.enabled ?? true;
                this.slot = orderDefinition?.slot ?? null;
            } else {
                this.isEnabled =
                    appEnabledState && typeof appEnabledState?.val === 'boolean' ? !!appEnabledState.val : true;
                this.slot = appSlotState && typeof appSlotState?.val === 'number' ? appSlotState.val : null;
            }

            // Ack if changed while instance was stopped
            if (!appEnabledState || !appEnabledState?.ack || appEnabledState?.val !== this.isEnabled) {
                await this.adapter.setState(`apps.${appName}.enabled`, { val: this.isEnabled, ack: true, c: 'init' });
            }

            if (!appSlotState || !appSlotState?.ack || appSlotState?.val !== this.slot) {
                await this.adapter.setState(`apps.${appName}.slot`, { val: this.slot, ack: true, c: 'init' });
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

            this.adapter.log.debug(
                `[createObjects] Creating objects for app "${appName}" (${this.isMainInstance() ? 'main' : this.objPrefix})`,
            );

            await this.adapter.extendObject(`apps.${appName}.enabled`, {
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

            await this.adapter.extendObject(`apps.${appName}.slot`, {
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
                    role: 'value',
                    read: true,
                    write: this.isMainInstance(),
                },
                native: {},
            });

            if (!this.isMainInstance()) {
                await this.adapter.subscribeForeignStatesAsync(`${this.objPrefix}.apps.${appName}.enabled`);
                await this.adapter.subscribeForeignStatesAsync(`${this.objPrefix}.apps.${appName}.slot`);
            }

            if (this.hasOwnActivateState()) {
                await this.adapter.extendObject(`apps.${appName}.activate`, {
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
                await this.adapter.delObjectAsync(`apps.${appName}.activate`);
                await this.adapter.subscribeForeignStatesAsync(`${this.objPrefix}.apps.${appName}.activate`);
            }
        }

        private async onStateChange(id: string, state: ioBroker.State | null | undefined): Promise<void> {
            const appName = this.getName();

            if (id) {
                // Handle default states for all apps
                if (state && !state.ack) {
                    // activate app
                    if (
                        id ===
                        `${this.hasOwnActivateState() ? this.adapter.namespace : this.objPrefix}.apps.${appName}.activate`
                    ) {
                        if (state.val) {
                            if (this.isEnabled) {
                                this.apiClient
                                    .requestAsync('apps/active', 'PUT', { name: appName })
                                    .then(async response => {
                                        if (response.status === 200 && response.data.ok === true) {
                                            const idOwnNamespace = this.getObjIdOwnNamespace(id);
                                            await this.adapter.setState(idOwnNamespace, { val: state.val, ack: true });
                                        }
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
                const idOwnNamespace = this.getObjIdOwnNamespace(id);

                if (id === `${this.objPrefix}.apps.${appName}.enabled`) {
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
                } else if (id === `${this.objPrefix}.apps.${appName}.slot` && typeof state.val === 'number') {
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
