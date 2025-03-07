import { Logger } from '../../../../cli/Logger';
import GlobalOptions from '../../../../GlobalOptions';
import request from '../../../../request';
import { formatting } from '../../../../utils/formatting';
import { urlUtil } from '../../../../utils/urlUtil';
import { validation } from '../../../../utils/validation';
import SpoCommand from '../../../base/SpoCommand';
import commands from '../../commands';

interface CommandArgs {
  options: Options;
}

interface Options extends GlobalOptions {
  webUrl: string;
  listId?: string;
  listTitle?: string;
  listUrl?: string;
  id?: string;
  name?: string;
  scope?: string;
}

class SpoEventreceiverGetCommand extends SpoCommand {
  public get name(): string {
    return commands.EVENTRECEIVER_GET;
  }

  public get description(): string {
    return 'Gets a specific event receiver attached to the web, site or list (if any of the list options are filled in) by receiver name of id';
  }

  constructor() {
    super();

    this.#initTelemetry();
    this.#initOptions();
    this.#initValidators();
    this.#initOptionSets();
  }

  #initTelemetry(): void {
    this.telemetry.push((args: CommandArgs) => {
      Object.assign(this.telemetryProperties, {
        listId: typeof args.options.listId !== 'undefined',
        listTitle: typeof args.options.listTitle !== 'undefined',
        listUrl: typeof args.options.listUrl !== 'undefined',
        scope: typeof args.options.scope !== 'undefined',
        id: typeof args.options.id !== 'undefined',
        name: typeof args.options.name !== 'undefined'
      });
    });
  }

  #initOptions(): void {
    this.options.unshift(
      {
        option: '-u, --webUrl <webUrl>'
      },
      {
        option: '--listTitle [listTitle]'
      },
      {
        option: '--listId  [listId]'
      },
      {
        option: '--listUrl [listUrl]'
      },
      {
        option: '-n, --name [name]'
      },
      {
        option: '-i, --id [id]'
      },
      {
        option: '-s, --scope [scope]',
        autocomplete: ['web', 'site']
      }
    );
  }

  #initValidators(): void {
    this.validators.push(
      async (args: CommandArgs) => {
        const isValidSharePointUrl: boolean | string = validation.isValidSharePointUrl(args.options.webUrl);
        if (isValidSharePointUrl !== true) {
          return isValidSharePointUrl;
        }
    
        const listOptions: any[] = [args.options.listId, args.options.listTitle, args.options.listUrl];
        if (listOptions.some(item => item !== undefined) && listOptions.filter(item => item !== undefined).length > 1) {
          return `Specify either list id or title or list url`;
        }
    
        if (args.options.listId && !validation.isValidGuid(args.options.listId)) {
          return `${args.options.listId} is not a valid GUID`;
        }
    
        if (args.options.scope && ['web', 'site'].indexOf(args.options.scope) === -1) {
          return `${args.options.scope} is not a valid type value. Allowed values web|site.`;
        }
    
        if (args.options.scope && args.options.scope === 'site' && (args.options.listId || args.options.listUrl || args.options.listTitle)) {
          return 'Scope cannot be set to site when retrieving list event receivers.';
        }
    
        return true;
      }
    );
  }

  #initOptionSets(): void {
    this.optionSets.push(['name', 'id']);
  }

  public async commandAction(logger: Logger, args: CommandArgs): Promise<void> {
    let requestUrl = `${args.options.webUrl}/_api/`;
    let listUrl: string = '';
    let filter: string = '?$filter=';

    if (args.options.listId) {
      listUrl = `lists(guid'${formatting.encodeQueryParameter(args.options.listId)}')/`;
    }
    else if (args.options.listTitle) {
      listUrl = `lists/getByTitle('${formatting.encodeQueryParameter(args.options.listTitle)}')/`;
    }
    else if (args.options.listUrl) {
      const listServerRelativeUrl: string = urlUtil.getServerRelativePath(args.options.webUrl, args.options.listUrl);
      listUrl = `GetList('${formatting.encodeQueryParameter(listServerRelativeUrl)}')/`;
    }

    if (!args.options.scope || args.options.scope === 'web') {
      requestUrl += `web/${listUrl}eventreceivers`;
    }
    else {
      requestUrl += 'site/eventreceivers';
    }

    if (args.options.id) {
      filter += `receiverid eq (guid'${args.options.id}')`;
    }
    else {
      filter += `receivername eq '${args.options.name}'`;
    }

    const requestOptions: any = {
      url: requestUrl + filter,
      headers: {
        'accept': 'application/json;odata=nometadata'
      },
      responseType: 'json'
    };

    try {
      const res = await request.get<{ value: any[] }>(requestOptions);
      logger.log(res.value);
    }
    catch (err: any) {
      this.handleRejectedODataJsonPromise(err);
    }
  }
}

module.exports = new SpoEventreceiverGetCommand(); 