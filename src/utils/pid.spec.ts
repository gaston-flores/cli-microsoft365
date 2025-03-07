import * as assert from 'assert';
import * as child_process from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as sinon from 'sinon';
import { cache } from './cache';
import { pid } from './pid';
import { sinonUtil } from './sinonUtil';

describe('utils/pid', () => {
  let cacheSetValueStub: sinon.SinonStub;

  before(() => {
    sinon.stub(cache, 'getValue').callsFake(() => undefined);
    cacheSetValueStub = sinon.stub(cache, 'setValue').callsFake(() => undefined);
  });

  afterEach(() => {
    sinonUtil.restore([
      os.platform,
      child_process.execSync,
      fs.existsSync,
      fs.readFileSync
    ]);
  });

  after(() => {
    sinonUtil.restore([
      cache.getValue,
      cache.setValue
    ]);
  });

  it('retrieves process name on Windows', () => {
    sinon.stub(os, 'platform').callsFake(() => 'win32');
    sinon.stub(child_process, 'execSync').callsFake(() => 'pwsh');

    assert.strictEqual(pid.getProcessName(123), 'pwsh');
  });

  it('retrieves process name on macOS', () => {
    sinon.stub(os, 'platform').callsFake(() => 'darwin');
    sinon.stub(child_process, 'execSync').callsFake(() => '/bin/bash');

    assert.strictEqual(pid.getProcessName(123), '/bin/bash');
  });

  it('retrieves process name on Linux', () => {
    sinon.stub(os, 'platform').callsFake(() => 'linux');
    sinon.stub(fs, 'existsSync').callsFake(() => true);
    sinon.stub(fs, 'readFileSync').callsFake(() => '(pwsh)');

    assert.strictEqual(pid.getProcessName(123), 'pwsh');
  });

  it(`returns undefined on Linux if the process is not found`, () => {
    sinon.stub(os, 'platform').callsFake(() => 'linux');
    sinon.stub(fs, 'existsSync').callsFake(() => false);

    assert.strictEqual(pid.getProcessName(123), undefined);
  });

  it('returns undefined name on other platforms', () => {
    sinon.stub(os, 'platform').callsFake(() => 'android');

    assert.strictEqual(pid.getProcessName(123), undefined);
  });

  it('returns undefined when retrieving process name fails', () => {
    sinon.stub(os, 'platform').callsFake(() => 'win32');
    sinon.stub(child_process, 'execSync').throws();

    assert.strictEqual(pid.getProcessName(123), undefined);
  });

  it('stores retrieved process name in cache', () => {
    sinon.stub(os, 'platform').callsFake(() => 'win32');
    sinon.stub(child_process, 'execSync').callsFake(() => 'pwsh');

    pid.getProcessName(123);

    assert(cacheSetValueStub.called);
  });

  it('retrieves process name from cache when available', () => {
    sinonUtil.restore(cache.getValue);
    sinon.stub(cache, 'getValue').callsFake(() => 'pwsh');
    const osPlatformSpy = sinon.spy(os, 'platform');

    assert.strictEqual(pid.getProcessName(123), 'pwsh');
    assert(osPlatformSpy.notCalled);
  });
});