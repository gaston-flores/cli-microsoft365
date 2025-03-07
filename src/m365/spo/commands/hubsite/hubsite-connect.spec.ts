import * as assert from 'assert';
import * as sinon from 'sinon';
import appInsights from '../../../../appInsights';
import auth from '../../../../Auth';
import { Cli } from '../../../../cli/Cli';
import { CommandInfo } from '../../../../cli/CommandInfo';
import { Logger } from '../../../../cli/Logger';
import Command, { CommandError } from '../../../../Command';
import request from '../../../../request';
import { pid } from '../../../../utils/pid';
import { sinonUtil } from '../../../../utils/sinonUtil';
import { spo } from '../../../../utils/spo';
import commands from '../../commands';
const command: Command = require('./hubsite-connect');

describe(commands.HUBSITE_CONNECT, () => {
  let log: string[];
  let logger: Logger;
  let loggerLogSpy: sinon.SinonSpy;
  let commandInfo: CommandInfo;

  before(() => {
    sinon.stub(auth, 'restoreAuth').callsFake(() => Promise.resolve());
    sinon.stub(appInsights, 'trackEvent').callsFake(() => {});
    sinon.stub(spo, 'getRequestDigest').callsFake(() => Promise.resolve({
      FormDigestValue: 'ABC',
      FormDigestTimeoutSeconds: 1800,
      FormDigestExpiresAt: new Date(),
      WebFullUrl: 'https://contoso.sharepoint.com'
    }));
    auth.service.connected = true;
    commandInfo = Cli.getCommandInfo(command);
  });

  beforeEach(() => {
    log = [];
    logger = {
      log: (msg: string) => {
        log.push(msg);
      },
      logRaw: (msg: string) => {
        log.push(msg);
      },
      logToStderr: (msg: string) => {
        log.push(msg);
      }
    };
    loggerLogSpy = sinon.spy(logger, 'log');
  });

  afterEach(() => {
    sinonUtil.restore([
      request.post
    ]);
  });

  after(() => {
    sinonUtil.restore([
      auth.restoreAuth,
      spo.getRequestDigest,
      appInsights.trackEvent,
      pid.getProcessName
    ]);
    auth.service.connected = false;
  });

  it('has correct name', () => {
    assert.strictEqual(command.name.startsWith(commands.HUBSITE_CONNECT), true);
  });

  it('has a description', () => {
    assert.notStrictEqual(command.description, null);
  });

  it('connects site to the hub site', async () => {
    sinon.stub(request, 'post').callsFake((opts) => {
      if ((opts.url as string).indexOf(`/_api/site/JoinHubSite('255a50b2-527f-4413-8485-57f4c17a24d1')`) > -1) {
        return Promise.resolve({
          "odata.null": true
        });
      }

      return Promise.reject('Invalid request');
    });

    await command.action(logger, { options: { debug: false, url: 'https://contoso.sharepoint.com/sites/sales', hubSiteId: '255a50b2-527f-4413-8485-57f4c17a24d1' } });
    assert(loggerLogSpy.notCalled);
  });

  it('correctly handles error when the specified id doesn\'t point to a valid hub site', async () => {
    sinon.stub(request, 'post').callsFake(() => {
      return Promise.reject({
        error: {
          "odata.error": {
            "code": "-1, Microsoft.SharePoint.Client.ResourceNotFoundException",
            "message": {
              "lang": "en-US",
              "value": "Exception of type 'Microsoft.SharePoint.Client.ResourceNotFoundException' was thrown."
            }
          }
        }
      });
    });

    await assert.rejects(command.action(logger, { options: { debug: false, url: 'https://contoso.sharepoint.com/sites/sales', hubSiteId: '255a50b2-527f-4413-8485-57f4c17a24d1' } } as any),
      new CommandError('Exception of type \'Microsoft.SharePoint.Client.ResourceNotFoundException\' was thrown.'));
  });

  it('supports debug mode', () => {
    const options = command.options;
    let containsOption = false;
    options.forEach(o => {
      if (o.option === '--debug') {
        containsOption = true;
      }
    });
    assert(containsOption);
  });

  it('supports specifying site collection URL', () => {
    const options = command.options;
    let containsOption = false;
    options.forEach(o => {
      if (o.option.indexOf('--url') > -1) {
        containsOption = true;
      }
    });
    assert(containsOption);
  });

  it('supports specifying hub site ID', () => {
    const options = command.options;
    let containsOption = false;
    options.forEach(o => {
      if (o.option.indexOf('--hubSiteId') > -1) {
        containsOption = true;
      }
    });
    assert(containsOption);
  });

  it('fails validation if the specified site collection URL is not a valid SharePoint URL', async () => {
    const actual = await command.validate({ options: { url: 'site.com', hubSiteId: '255a50b2-527f-4413-8485-57f4c17a24d1' } }, commandInfo);
    assert.notStrictEqual(actual, true);
  });

  it('fails validation if the hub site ID is not a valid GUID', async () => {
    const actual = await command.validate({ options: { url: 'https://contoso.sharepoint.com/sites/sales', hubSiteId: 'abc' } }, commandInfo);
    assert.notStrictEqual(actual, true);
  });

  it('passes validation when all required parameters are valid', async () => {
    const actual = await command.validate({ options: { url: 'https://contoso.sharepoint.com/sites/sales', hubSiteId: '255a50b2-527f-4413-8485-57f4c17a24d1' } }, commandInfo);
    assert.strictEqual(actual, true);
  });
});