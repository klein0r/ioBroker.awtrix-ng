import { utils } from '@iobroker/testing';
import { AwtrixClient, type AppInfo, type BuiltinAppInfo, type DeviceState, type OkResponse } from 'awtrix-ng-api';
import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import { EventEmitter } from 'node:events';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import proxyquire from 'proxyquire';
import sinon from 'sinon';
import type {} from 'sinon-chai';

import jsonConfig from '../admin/jsonConfig.json';
import ioPackage from '../io-package.json';
import type { AwtrixNg } from './awtrix-ng';
import { AppType as BuiltinAppType } from './lib/app-type/builtin';

function builtin(name: string, enabled: boolean, slot = 0): BuiltinAppInfo {
    return { name, origin: 'builtin', enabled, inLoop: enabled, present: true, slot };
}

const deviceState: DeviceState = {
    version: '1.2.2',
    uid: 'test-device',
    boardType: 'awtrixng',
    soc: 'esp32',
    ipAddress: '127.0.0.1',
    hostname: 'awtrix-test',
    wifiRssi: -50,
    uptimeSeconds: 100,
    resetReason: 'poweron',
    freeHeapBytes: 100_000,
    minFreeHeapBytes: 90_000,
    scriptingRunning: false,
    scriptHeapPool: 'internal',
    scriptHeapBudgetBytes: 0,
    fps: 30,
    brightness: 100,
    matrixPower: true,
    currentApp: 'Time',
    indicators: [],
    messageCount: 0,
    mqtt: {
        enabled: false,
        state: 'disabled',
        host: '',
        endpoint: '',
        attempts: 0,
        retryInMs: 0,
        connects: 0,
        error: null,
        lastError: null,
    },
};

type Fixture = {
    adapter: AwtrixNg;
    apiClient: AwtrixClient;
    database: ReturnType<typeof utils.unit.createMocks>['database'];
    mock: ReturnType<typeof utils.unit.createMocks>['adapter'];
    list: sinon.SinonStubbedInstance<AwtrixClient['apps']>['list'];
    setOrder: sinon.SinonStubbedInstance<AwtrixClient['apps']>['setOrder'];
    setEnabled: sinon.SinonStubbedInstance<AwtrixClient['apps']>['setEnabled'];
    getDevice: sinon.SinonStubbedInstance<AwtrixClient['device']>['get'];
    initialize: () => Promise<number>;
};

function createFixture(config: Partial<ioBroker.AdapterConfig> = {}, instance = 0): Fixture {
    const mocks = utils.unit.createMocks({
        name: 'awtrix-ng',
        instance,
    });
    mocks.adapter.config = { ...ioPackage.native, removeAppsOnStop: false, ...config };

    class AdapterMock extends EventEmitter {
        public FORBIDDEN_CHARS = /[\][*,;"'`<>\\?]/g;
        public setTimeout = setTimeout;
        public clearTimeout = clearTimeout;

        public constructor() {
            super();
            Object.assign(this, mocks.adapter);
            this.on = (eventName, listener) => {
                super.on(eventName, listener);
                return this;
            };
            this.removeListener = (eventName, listener) => {
                super.removeListener(eventName, listener);
                return this;
            };
        }

        public removeNamespace(id: string): string {
            const prefix = `${mocks.adapter.namespace}.`;
            return id.startsWith(prefix) ? id.substring(prefix.length) : id;
        }
    }

    const { AwtrixNg: Adapter }: { AwtrixNg: typeof AwtrixNg } = proxyquire('./awtrix-ng', {
        '@iobroker/adapter-core': { Adapter: AdapterMock, '@noCallThru': true },
    });
    const adapter = new Adapter();
    const apiClient = new AwtrixClient({ host: '127.0.0.1' });
    const list = sinon.stub(apiClient.apps, 'list').resolves([builtin('Battery', false)]);
    const setOrder = sinon.stub(apiClient.apps, 'setOrder').resolves({ ok: true });
    const setEnabled = sinon.stub(apiClient.apps, 'setEnabled').resolves({ ok: true });
    const getDevice = sinon.stub(apiClient.device, 'get').resolves(deviceState);

    adapter['apiClient'] = apiClient;
    adapter['apiConnected'] = true;
    adapter['sendWelcomeNotification'] = sinon.stub();
    adapter['refreshSettings'] = sinon.stub().resolves();
    adapter['refreshCapabilities'] = sinon.stub().resolves();
    adapter['refreshDisplay'] = sinon.stub().resolves();
    adapter['refreshAudio'] = sinon.stub().resolves();
    adapter['updateAllIndicatorsByStates'] = sinon.stub().resolves();
    adapter['updateMoodlightByStates'] = sinon.stub().resolves();
    adapter['initScreenContentDownload'] = sinon.stub().resolves();
    if (config.foreignSettingsInstance) {
        adapter['_isMainInstance'] = false;
    }

    return {
        adapter,
        apiClient,
        database: mocks.database,
        mock: mocks.adapter,
        list,
        setOrder,
        setEnabled,
        getDevice,
        initialize: () => adapter.runAppOrderExclusive(() => adapter['createAppObjects']()),
    };
}

function getBuiltin(adapter: AwtrixNg, name = 'Battery'): BuiltinAppType.Builtin {
    const app = adapter['apps'].find(app => app.getName() === name);
    if (!(app instanceof BuiltinAppType.Builtin)) {
        throw new Error(`Missing built-in app ${name}`);
    }
    return app;
}

async function importFromAdmin(fixture: Fixture): Promise<unknown> {
    return new Promise(resolve => {
        fixture.adapter.sendTo = sinon.stub().callsFake((_from: string, _command: string, response: unknown) => {
            resolve(response);
        });
        fixture.adapter['onMessage']({
            _id: 1,
            from: 'system.adapter.admin.0',
            command: jsonConfig.items._customApps.items._importBuiltinApps.command,
            message: {},
            callback: { id: 1, message: {}, ack: false, time: Date.now() },
        });
    });
}

describe('Built-in app synchronization', function () {
    this.timeout(10_000);

    afterEach(() => sinon.restore());

    it('keeps ioBroker in charge when automatic synchronization is disabled', async () => {
        const fixture = createFixture();
        fixture.database.publishState('awtrix-ng.0.apps.Battery.enabled', { val: true, ack: true });

        await fixture.initialize();

        expect(getBuiltin(fixture.adapter).enabled()).to.equal(true);
        expect(fixture.setOrder.lastCall.args[0]).to.deep.equal({ order: ['Battery'], disabled: [] });
    });

    it('imports device activation before the first order write on connect', async () => {
        const fixture = createFixture({ syncBuiltinApps: true });
        fixture.database.publishState('awtrix-ng.0.apps.Battery.enabled', { val: true, ack: true });
        fixture.adapter['apiConnected'] = false;

        await fixture.adapter['setApiConnected'](true);

        expect(fixture.database.getState('awtrix-ng.0.apps.Battery.enabled')).to.include({ val: false, ack: true });
        expect(getBuiltin(fixture.adapter).enabled()).to.equal(false);
        expect(fixture.setOrder).to.have.been.calledOnceWithExactly({ order: ['Battery'], disabled: ['Battery'] });
        expect(fixture.list).to.have.been.calledOnce;
        expect(fixture.setEnabled).not.to.have.been.called;
    });

    it('imports both enabled and disabled built-ins without changing other apps or slots', async () => {
        const fixture = createFixture({ syncBuiltinApps: true });
        const script: AppInfo = { ...builtin('external', false, 2), origin: 'script' };
        fixture.list.resolves([builtin('Battery', false, 1), builtin('Temperature', true), script]);
        fixture.database.publishStates({
            'awtrix-ng.0.apps.Battery.enabled': { val: true, ack: true },
            'awtrix-ng.0.apps.Battery.slot': { val: 0, ack: true },
            'awtrix-ng.0.apps.Temperature.enabled': { val: false, ack: true },
            'awtrix-ng.0.apps.Temperature.slot': { val: 1, ack: true },
            'awtrix-ng.0.apps.external.enabled': { val: true, ack: true },
            'awtrix-ng.0.apps.external.slot': { val: 2, ack: true },
        });

        await fixture.initialize();

        expect(fixture.setOrder.lastCall.args[0]).to.deep.equal({
            order: ['Battery', 'Temperature', 'external'],
            disabled: ['Battery'],
        });
        expect(fixture.database.getState('awtrix-ng.0.apps.Temperature.enabled')).to.include({
            val: true,
            ack: true,
        });
        expect(fixture.database.getState('awtrix-ng.0.apps.external.enabled')?.val).to.equal(true);
    });

    it('imports on reconnect instead of restoring cached activation', async () => {
        const fixture = createFixture({ syncBuiltinApps: true });
        fixture.list.resolves([builtin('Battery', true)]);
        await fixture.initialize();
        fixture.list.resolves([builtin('Battery', false)]);

        await fixture.adapter['setApiConnected'](false);
        await fixture.adapter['setApiConnected'](true);

        expect(fixture.setOrder.lastCall.args[0].disabled).to.deep.equal(['Battery']);
        expect(fixture.database.getState('awtrix-ng.0.apps.Battery.enabled')?.val).to.equal(false);
    });

    it('checks activation again before a slot change can overwrite a web-interface change', async () => {
        const fixture = createFixture({ syncBuiltinApps: true });
        fixture.list.resolves([builtin('Battery', true)]);
        await fixture.initialize();
        fixture.list.resolves([builtin('Battery', false)]);

        await fixture.adapter.moveApp(getBuiltin(fixture.adapter), 0);

        expect(fixture.list).to.have.been.calledTwice;
        expect(fixture.setOrder.lastCall.args[0].disabled).to.deep.equal(['Battery']);
    });

    it('imports activation when polling detects a device reboot', async () => {
        const clock = sinon.useFakeTimers();
        const fixture = createFixture({ syncBuiltinApps: true });
        fixture.list.resolves([builtin('Battery', true)]);
        await fixture.initialize();
        fixture.adapter['lastUptimeSeconds'] = 500;
        fixture.getDevice.resolves({ ...deviceState, uptimeSeconds: 1 });
        fixture.list.resolves([builtin('Battery', false)]);

        fixture.adapter['refreshState']();
        await clock.tickAsync(0);

        expect(fixture.setOrder.lastCall.args[0].disabled).to.deep.equal(['Battery']);
        expect(getBuiltin(fixture.adapter).enabled()).to.equal(false);
    });

    it('polls activation every 60 seconds without writing it back to the device', async () => {
        const clock = sinon.useFakeTimers();
        const fixture = createFixture({ syncBuiltinApps: true });
        fixture.list.resolves([builtin('Battery', true)]);
        await fixture.initialize();
        fixture.setOrder.resetHistory();
        fixture.list.resetHistory();

        fixture.adapter['refreshState']();
        await clock.tickAsync(0);
        expect(fixture.list).to.have.been.calledOnce;

        fixture.list.resolves([builtin('Battery', false)]);
        await clock.tickAsync(59_999);
        expect(fixture.list).to.have.been.calledOnce;
        expect(getBuiltin(fixture.adapter).enabled()).to.equal(true);

        await clock.tickAsync(1);
        expect(fixture.list).to.have.been.calledTwice;
        expect(fixture.database.getState('awtrix-ng.0.apps.Battery.enabled')).to.include({ val: false, ack: true });
        expect(getBuiltin(fixture.adapter).enabled()).to.equal(false);
        expect(fixture.setOrder).not.to.have.been.called;
        expect(fixture.setEnabled).not.to.have.been.called;
    });

    it('does not poll app activation when the option is off', async () => {
        const clock = sinon.useFakeTimers();
        const fixture = createFixture();
        await fixture.initialize();
        fixture.list.resetHistory();

        fixture.adapter['refreshState']();
        await clock.tickAsync(60_000);

        expect(fixture.list).not.to.have.been.called;
    });

    it('imports manually with the option off and retains the values in a new adapter instance', async () => {
        const fixture = createFixture();
        fixture.list.resolves([builtin('Battery', true)]);
        await fixture.initialize();
        fixture.list.resolves([builtin('Battery', false)]);
        fixture.setOrder.resetHistory();

        expect(await importFromAdmin(fixture)).to.deep.equal({ result: 'ok', count: 1 });
        expect(fixture.database.getState('awtrix-ng.0.apps.Battery.enabled')).to.include({ val: false, ack: true });
        expect(getBuiltin(fixture.adapter).enabled()).to.equal(false);
        expect(fixture.setEnabled).not.to.have.been.called;
        expect(fixture.setOrder).not.to.have.been.called;

        const restarted = createFixture();
        for (const [id, state] of fixture.database.states) {
            restarted.database.publishState(id, state);
        }
        await restarted.initialize();
        expect(restarted.setOrder.lastCall.args[0].disabled).to.deep.equal(['Battery']);
    });

    it('still allows ioBroker to switch a built-in app with automatic synchronization on', async () => {
        const fixture = createFixture({ syncBuiltinApps: true });
        await fixture.initialize();
        const app = getBuiltin(fixture.adapter);

        await app['stateChanged']('awtrix-ng.0.apps.Battery.enabled', {
            val: true,
            ack: false,
            ts: 1,
            lc: 1,
            from: 'system.adapter.admin.0',
        });

        expect(fixture.setEnabled).to.have.been.calledOnceWithExactly('Battery', true);
        expect(app.enabled()).to.equal(true);
        expect(fixture.database.getState('awtrix-ng.0.apps.Battery.enabled')).to.include({ val: true, ack: true });

        await app['stateChanged'](
            'awtrix-ng.0.apps.Battery.enabled',
            fixture.database.getState('awtrix-ng.0.apps.Battery.enabled'),
        );
        expect(fixture.setEnabled).to.have.been.calledOnce;
    });

    it('serializes an import with an incoming ioBroker command so a stale response cannot win', async () => {
        const fixture = createFixture();
        await fixture.initialize();
        const response = Promise.withResolvers<AppInfo[]>();
        fixture.list.returns(response.promise);

        const importing = fixture.adapter.runAppOrderExclusive(() => fixture.adapter['importBuiltinApps']());
        await Promise.resolve();
        const switching = getBuiltin(fixture.adapter)['stateChanged']('awtrix-ng.0.apps.Battery.enabled', {
            val: true,
            ack: false,
            ts: 1,
            lc: 1,
            from: 'system.adapter.admin.0',
        });
        expect(fixture.setEnabled).not.to.have.been.called;
        response.resolve([builtin('Battery', false)]);

        await Promise.all([importing, switching]);

        expect(getBuiltin(fixture.adapter).enabled()).to.equal(true);
        expect(fixture.database.getState('awtrix-ng.0.apps.Battery.enabled')).to.include({ val: true, ack: true });
        expect(fixture.setEnabled).to.have.been.calledOnceWithExactly('Battery', true);
    });

    it('waits for a pending ioBroker write before requesting activation from the device', async () => {
        const fixture = createFixture();
        await fixture.initialize();
        fixture.list.resetHistory();
        const response = Promise.withResolvers<OkResponse>();
        fixture.setEnabled.returns(response.promise);
        const switching = getBuiltin(fixture.adapter)['stateChanged']('awtrix-ng.0.apps.Battery.enabled', {
            val: true,
            ack: false,
            ts: 1,
            lc: 1,
            from: 'system.adapter.admin.0',
        });
        await Promise.resolve();

        const importing = fixture.adapter.runAppOrderExclusive(() => fixture.adapter['importBuiltinApps']());
        await Promise.resolve();
        expect(fixture.list).not.to.have.been.called;
        fixture.list.resolves([builtin('Battery', true)]);
        response.resolve({ ok: true });
        await Promise.all([switching, importing]);

        expect(fixture.list).to.have.been.calledOnce;
        expect(getBuiltin(fixture.adapter).enabled()).to.equal(true);
    });

    it('reports an offline manual import instead of succeeding', async () => {
        const fixture = createFixture();
        fixture.adapter['apiConnected'] = false;

        expect(await importFromAdmin(fixture)).to.deep.equal({ error: 'API is not connected (device offline?)' });
        expect(fixture.list).not.to.have.been.called;
        expect(fixture.mock.log.warn).to.have.been.calledOnce;
    });

    it('reports API failures without changing objects and can retry afterwards', async () => {
        const fixture = createFixture();
        fixture.list.resolves([builtin('Battery', true)]);
        await fixture.initialize();
        fixture.list.rejects(new Error('Request timed out'));

        expect(await importFromAdmin(fixture)).to.deep.equal({ error: 'Request timed out' });
        expect(fixture.database.getState('awtrix-ng.0.apps.Battery.enabled')?.val).to.equal(true);

        fixture.list.resolves([builtin('Battery', false)]);
        expect(await importFromAdmin(fixture)).to.deep.equal({ result: 'ok', count: 1 });
    });

    it('reports a failed state write without updating the cached activation', async () => {
        const fixture = createFixture();
        fixture.list.resolves([builtin('Battery', true)]);
        await fixture.initialize();
        fixture.list.resolves([builtin('Battery', false)]);
        fixture.adapter.setStateChangedAsync = sinon.stub().rejects(new Error('State database unavailable'));

        expect(await importFromAdmin(fixture)).to.deep.equal({ error: 'State database unavailable' });
        expect(getBuiltin(fixture.adapter).enabled()).to.equal(true);
        expect(fixture.database.getState('awtrix-ng.0.apps.Battery.enabled')?.val).to.equal(true);
    });

    it('retries failed polling without marking a responsive device offline', async () => {
        const clock = sinon.useFakeTimers();
        const fixture = createFixture({ syncBuiltinApps: true });
        fixture.list.resolves([builtin('Battery', true)]);
        await fixture.initialize();
        fixture.list.rejects(new Error('Request timed out'));

        fixture.adapter['refreshState']();
        await clock.tickAsync(0);
        expect(fixture.adapter.isApiConnected()).to.equal(true);
        expect(getBuiltin(fixture.adapter).enabled()).to.equal(true);
        expect(fixture.mock.log.warn).to.have.been.calledWithMatch('Unable to import built-in apps');

        fixture.list.resolves([builtin('Battery', false)]);
        await clock.tickAsync(60_000);
        expect(getBuiltin(fixture.adapter).enabled()).to.equal(false);
    });

    it('does not write stale activation if reading before an order update fails', async () => {
        const fixture = createFixture({ syncBuiltinApps: true });
        await fixture.initialize();
        fixture.setOrder.resetHistory();
        fixture.list.rejects(new Error('Request timed out'));

        await fixture.adapter.refreshAppOrder();

        expect(fixture.setOrder).not.to.have.been.called;
        expect(fixture.mock.log.error).to.have.been.calledWithMatch('Request timed out');
    });

    it('rejects an import before app initialization without writing any states', async () => {
        const fixture = createFixture();

        expect(await importFromAdmin(fixture)).to.deep.equal({
            error: 'Built-in app "Battery" is not initialized yet - retry after synchronization',
        });
        expect(fixture.database.hasState('awtrix-ng.0.apps.Battery.enabled')).to.equal(false);
    });

    it('validates all imported activation values before changing any app', async () => {
        const fixture = createFixture();
        fixture.list.resolves([builtin('Battery', true), builtin('Temperature', true, 1)]);
        await fixture.initialize();
        const invalid = { ...builtin('Temperature', true, 1), enabled: 'false' };
        fixture.list.resolves(JSON.parse(JSON.stringify([builtin('Battery', false), invalid])));

        expect(await importFromAdmin(fixture)).to.deep.equal({
            error: 'Invalid activation state for built-in app "Temperature"',
        });
        expect(getBuiltin(fixture.adapter).enabled()).to.equal(true);
        expect(fixture.database.getState('awtrix-ng.0.apps.Battery.enabled')?.val).to.equal(true);
    });

    it('reports a missing built-in inventory instead of a successful empty import', async () => {
        const fixture = createFixture();
        await fixture.initialize();
        fixture.list.resolves([]);

        expect(await importFromAdmin(fixture)).to.deep.equal({ error: 'No built-in apps reported by the device' });
    });

    it('keeps followers controlled by their main instance and disables local imports', async () => {
        const clock = sinon.useFakeTimers();
        const fixture = createFixture({ syncBuiltinApps: true, foreignSettingsInstance: 'awtrix-ng.0' }, 1);
        fixture.database.publishState('awtrix-ng.0.apps.Battery.enabled', { val: true, ack: true });
        await fixture.initialize();
        expect(fixture.setOrder.lastCall.args[0].disabled).to.deep.equal([]);
        fixture.list.resetHistory();

        fixture.adapter['refreshState']();
        await clock.tickAsync(0);
        expect(fixture.list).not.to.have.been.called;
        expect(await importFromAdmin(fixture)).to.deep.equal({
            error: 'Import built-in apps in the main instance, not in an instance using its app settings',
        });
    });

    it('propagates acknowledged imports from the main instance to a follower without duplicate writes', async () => {
        const fixture = createFixture({ foreignSettingsInstance: 'awtrix-ng.0' }, 1);
        fixture.database.publishState('awtrix-ng.0.apps.Battery.enabled', { val: true, ack: true });
        await fixture.initialize();
        const app = getBuiltin(fixture.adapter);
        const state: ioBroker.State = {
            val: false,
            ack: true,
            ts: 1,
            lc: 1,
            from: 'system.adapter.awtrix-ng.0',
        };

        await app['stateChanged']('awtrix-ng.0.apps.Battery.enabled', state);
        await app['stateChanged']('awtrix-ng.0.apps.Battery.enabled', state);

        expect(fixture.setEnabled).to.have.been.calledOnceWithExactly('Battery', false);
        expect(app.enabled()).to.equal(false);
        expect(fixture.database.getState('awtrix-ng.1.apps.Battery.enabled')).to.include({ val: false, ack: true });
    });
});

describe('Built-in app admin controls', () => {
    const controls = jsonConfig.items._customApps.items;
    const checkbox = controls.syncBuiltinApps;
    const button = controls._importBuiltinApps;

    it('defaults to the existing behavior and exposes a guarded manual action', () => {
        expect(ioPackage.native.syncBuiltinApps).to.equal(false);
        expect(checkbox.type).to.equal('checkbox');
        expect(button.type).to.equal('sendTo');
        expect(button.command).to.equal('importBuiltinApps');
        expect(button.data).to.deep.equal({});
        expect(button.disabled).to.equal('!_alive || _changed');
        expect(checkbox.hidden).to.equal('!!data.foreignSettingsInstance');
        expect(button.hidden).to.equal(checkbox.hidden);
    });

    it('provides translations for every new control and its success message', () => {
        const keys = [
            controls._headerBuiltinApps.text,
            checkbox.label,
            checkbox.help,
            button.label,
            button.help,
            button.result.ok,
        ];
        const directory = join(__dirname, '../admin/i18n');
        for (const file of readdirSync(directory).filter(file => file.endsWith('.json'))) {
            const translations: Record<string, string> = JSON.parse(readFileSync(join(directory, file), 'utf8'));
            for (const key of keys) {
                expect(translations[key], `${file}: ${key}`).to.be.a('string').and.not.to.equal('');
            }
        }
    });
});
