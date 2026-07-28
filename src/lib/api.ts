import type { AxiosInstance, AxiosResponse } from 'axios';
import axios from 'axios';
import type { AwtrixNg } from '../main';

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace AwtrixApi {
    export type App = {
        // Text
        text?: string | Array<AppTextColoredFragment>;
        textCase?: 'inherit' | 'upper' | 'asTyped';
        textColor?: string | 'palette';
        textBlinkMs?: number;
        textFadeMs?: number;
        textCenter?: boolean;
        scroll?: 'inherited' | AppTextScroll;
        textOffsetX?: number;
        textInFront?: boolean;
        // Icon
        icon?: string;
        iconMode?: 'fixed' | 'pushOnce' | 'push';
        iconOffsetX?: number;
        // Timing
        durationMs?: number;
        lifetimeMs?: number;
        lifetimeExpiry?: 'remove' | 'mark';
        repeat?: number;
        // Background
        backgroundColor?: string;
        // Charts
        barChart?: Array<number>;
        lineChart?: Array<number>;
        chartAutoscale?: boolean;
        chartColor?: string;
        // Progress bar
        progress?: number;
        progressColor?: string;
        progressTrackColor?: string;
        // Effects
        effect?: string;
        effectSpeed?: number;
        // Palette
        palette?: string; // Cloud, Lava, Ocean, Forest, Stripe, Party, Heat, Rainbow
        paletteBlend?: boolean;
        paletteSpan?: number;
        paletteSpeed?: number;
        // Overlay
        overlay?: string; // rain · snow · drizzle · storm · thunder · frost
        // Draw commands
        draw?: Array<object>;
    };

    export type AppTextColoredFragment = {
        text: string;
        color: any;
    };

    export type AppTextScroll = {
        mode?: 'static' | 'wrap' | 'loop' | 'bounce';
        direction?: 'left' | 'right';
        entry?: 'inline' | 'offscreen';
        whenFits?: 'static' | 'scroll';
        speed?: number;
        gap?: number;
    };

    export type Settings = {
        key: string;
        value: any;
    };

    export type Indicator = {
        color?: string;
        blinkMs?: number;
        fadeMs?: number;
    };

    export type Moodlight = {
        brightness?: number;
        color?: string;
    };

    export class Client {
        private adapter: AwtrixNg;
        private axiosInstance: AxiosInstance | undefined = undefined;
        private apiConnected: boolean = false;
        private lastErrorCode: number = -1;

        public constructor(
            adapter: AwtrixNg,
            ipAddress: string,
            port: number,
            httpTimeout: number,
            userName: string,
            userPassword: string,
        ) {
            this.adapter = adapter;

            this.adapter.log.info(`Starting - connecting to http://${ipAddress}:${port}/`);

            let httpAuth: axios.AxiosBasicCredentials | undefined = undefined;
            if (userName) {
                httpAuth = {
                    username: userName,
                    password: userPassword,
                };
            }

            this.axiosInstance = axios.create({
                baseURL: `http://${ipAddress}:${port}/api/v1/`,
                timeout: httpTimeout * 1000 || 3000,
                auth: httpAuth,
                validateStatus: status => {
                    return [200, 201].indexOf(status) > -1;
                },
                responseType: 'json',
            });
        }

        public isConnected(): boolean {
            return this.apiConnected;
        }

        public async getDeviceAsync(): Promise<any> {
            return new Promise<any>((resolve, reject) => {
                this.requestAsync('device', 'GET')
                    .then(response => {
                        if (response.status === 200) {
                            this.apiConnected = true;
                            resolve(response.data);
                        } else {
                            reject(new Error(`Request failed with status ${response.status}`, { cause: response }));
                        }
                    })
                    .catch(error => {
                        this.apiConnected = false;
                        reject(error instanceof Error ? error : new Error(String(error)));
                    });
            });
        }

        public async removeAppAsync(name: string): Promise<boolean> {
            return new Promise<boolean>((resolve, reject) => {
                if (this.apiConnected) {
                    this.appDeleteAsync(name)
                        .then(response => {
                            if (response.status === 200 && response.data.ok === true) {
                                this.adapter.log.debug(`[removeApp] Removed customApp app "${name}"`);
                                resolve(true);
                            } else {
                                reject(new Error(`${response.status}: ${response.data}`, { cause: response }));
                            }
                        })
                        .catch(reject);
                } else {
                    reject(new Error('API not connected'));
                }
            });
        }

        public async settingsRequestAsync(data: AwtrixApi.Settings): Promise<AxiosResponse> {
            return this.requestAsync('settings', 'POST', { [data.key]: data.value });
        }

        public async indicatorRequestAsync(index: number, data?: AwtrixApi.Indicator): Promise<AxiosResponse> {
            return this.requestAsync(`indicators/${index}`, 'PUT', data);
        }

        public async indicatorDeleteAsync(index: number): Promise<AxiosResponse> {
            return this.requestAsync(`indicators/${index}`, 'DELETE');
        }

        public async appRequestAsync(name: string, data?: AwtrixApi.App): Promise<AxiosResponse> {
            return this.requestAsync(`apps/pushed/${name}`, 'PUT', data);
        }

        public async appDeleteAsync(name: string): Promise<AxiosResponse> {
            return this.requestAsync(`apps/${name}`, 'DELETE');
        }

        public async requestAsync(url: string, method?: string, data?: object | string): Promise<AxiosResponse> {
            return new Promise<AxiosResponse>((resolve, reject) => {
                if (data) {
                    this.adapter.log.debug(
                        `sending "${method}" request to "${url}" with data: ${JSON.stringify(data)}`,
                    );
                } else {
                    this.adapter.log.debug(`sending "${method}" request to "${url}" without data`);
                }

                this.axiosInstance!.request({
                    url,
                    method,
                    data,
                    headers: {
                        'Content-Type': typeof data === 'string' ? 'text/plain' : 'application/json',
                    },
                })
                    .then(response => {
                        this.adapter.log.debug(
                            `received ${response.status} response from "${url}" with content: ${JSON.stringify(response.data)}`,
                        );

                        // no error - clear up reminder
                        this.lastErrorCode = -1;

                        resolve(response);
                    })
                    .catch(error => {
                        if (error.response) {
                            // The request was made and the server responded with a status code

                            if (error.response.status === 401) {
                                this.adapter.log.warn(
                                    'Unable to perform request. Looks like the device is protected with username / password. Check instance configuration!',
                                );
                            } else {
                                this.adapter.log.warn(
                                    `received ${error.response.status} response from ${url} with content: ${JSON.stringify(error.response.data)}`,
                                );
                            }
                        } else if (error.request) {
                            // The request was made but no response was received
                            // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
                            // http.ClientRequest in node.js

                            // avoid spamming of the same error when stuck in a reconnection loop
                            if (error.code === this.lastErrorCode) {
                                this.adapter.log.debug(error.message);
                            } else {
                                this.adapter.log.info(`error ${error.code} from ${url}: ${error.message}`);
                                this.lastErrorCode = error.code;
                            }
                        } else {
                            // Something happened in setting up the request that triggered an Error
                            this.adapter.log.error(error.message);
                        }

                        reject(error instanceof Error ? error : new Error(String(error)));
                    });
            });
        }
    }
}
