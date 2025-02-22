import { Logger } from '../../../../cli/Logger';
import GlobalOptions from '../../../../GlobalOptions';
import request from '../../../../request';
import { formatting } from '../../../../utils/formatting';
import { validation } from '../../../../utils/validation';
import SpoCommand from '../../../base/SpoCommand';
import commands from '../../commands';

interface CommandArgs {
  options: Options;
}

interface Options extends GlobalOptions {
  itemId: string;
  listId?: string;
  listTitle?: string;
  webUrl: string;
}

class SpoListItemAttachmentListCommand extends SpoCommand {
  public get name(): string {
    return commands.LISTITEM_ATTACHMENT_LIST;
  }

  public get description(): string {
    return 'Gets the attachments associated to a list item';
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
        listTitle: typeof args.options.listTitle !== 'undefined'
      });
    });
  }

  #initOptions(): void {
    this.options.unshift(
      {
        option: '-u, --webUrl <webUrl>'
      },
      {
        option: '--itemId <itemId>'
      },
      {
        option: '--listId [listId]'
      },
      {
        option: '--listTitle [listTitle]'
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

        if (args.options.listId && !validation.isValidGuid(args.options.listId)) {
          return `${args.options.listId} in option listId is not a valid GUID`;
        }

        if (isNaN(parseInt(args.options.itemId))) {
          return `${args.options.itemId} is not a number`;
        }

        return true;
      }
    );
  }

  #initOptionSets(): void {
    this.optionSets.push(['listId', 'listTitle']);
  }

  public defaultProperties(): string[] | undefined {
    return ['FileName', 'ServerRelativeUrl'];
  }

  public async commandAction(logger: Logger, args: CommandArgs): Promise<void> {
    const listIdArgument = args.options.listId || '';
    const listTitleArgument = args.options.listTitle || '';
    const listRestUrl: string = (args.options.listId ?
      `${args.options.webUrl}/_api/web/lists(guid'${formatting.encodeQueryParameter(listIdArgument)}')`
      : `${args.options.webUrl}/_api/web/lists/getByTitle('${formatting.encodeQueryParameter(listTitleArgument)}')`);

    const requestOptions: any = {
      url: `${listRestUrl}/items(${args.options.itemId})?$select=AttachmentFiles&$expand=AttachmentFiles`,
      method: 'GET',
      headers: {
        'accept': 'application/json;odata=nometadata'
      },
      responseType: 'json'
    };

    try {
      const attachmentFiles = await request.get<any>(requestOptions);

      if (attachmentFiles.AttachmentFiles && attachmentFiles.AttachmentFiles.length > 0) {
        logger.log(attachmentFiles.AttachmentFiles);
      }
      else {
        if (this.verbose) {
          logger.logToStderr('No attachments found');
        }
      }
    }
    catch (err: any) {
      this.handleRejectedODataJsonPromise(err);
    }
  }
}

module.exports = new SpoListItemAttachmentListCommand();
