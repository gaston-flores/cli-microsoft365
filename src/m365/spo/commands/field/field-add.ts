import { Logger } from '../../../../cli/Logger';
import GlobalOptions from '../../../../GlobalOptions';
import request from '../../../../request';
import { formatting } from '../../../../utils/formatting';
import { spo } from '../../../../utils/spo';
import { validation } from '../../../../utils/validation';
import SpoCommand from '../../../base/SpoCommand';
import commands from '../../commands';

interface CommandArgs {
  options: Options;
}

interface Options extends GlobalOptions {
  webUrl: string;
  listTitle?: string;
  xml: string;
  options?: string;
}

class SpoFieldAddCommand extends SpoCommand {
  public get name(): string {
    return commands.FIELD_ADD;
  }

  public get description(): string {
    return 'Adds a new list or site column using the CAML field definition';
  }

  constructor() {
    super();
  
    this.#initTelemetry();
    this.#initOptions();
    this.#initValidators();
  }
  
  #initTelemetry(): void {
    this.telemetry.push((args: CommandArgs) => {
      Object.assign(this.telemetryProperties, {
        listTitle: typeof args.options.listTitle !== 'undefined',
        options: typeof args.options.options !== 'undefined'
      });
    });
  }
  
  #initOptions(): void {
    this.options.unshift(
      {
        option: '-u, --webUrl <webUrl>'
      },
      {
        option: '-l, --listTitle [listTitle]'
      },
      {
        option: '-x, --xml <xml>'
      },
      {
        option: '--options [options]'
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
    
        if (args.options.options) {
          let optionsError: string | boolean = true;
          const options: string[] = ['DefaultValue', 'AddToDefaultContentType', 'AddToNoContentType', 'AddToAllContentTypes', 'AddFieldInternalNameHint', 'AddFieldToDefaultView', 'AddFieldCheckDisplayName'];
          args.options.options.split(',').forEach(o => {
            o = o.trim();
            if (options.indexOf(o) < 0) {
              optionsError = `${o} is not a valid value for the options argument. Allowed values are DefaultValue|AddToDefaultContentType|AddToNoContentType|AddToAllContentTypes|AddFieldInternalNameHint|AddFieldToDefaultView|AddFieldCheckDisplayName`;
            }
          });
          return optionsError;
        }
    
        return true;
      }
    );
  }

  public async commandAction(logger: Logger, args: CommandArgs): Promise<void> {
    try {
      const reqDigest = await spo.getRequestDigest(args.options.webUrl);
      const requestOptions: any = {
        url: `${args.options.webUrl}/_api/web/${(args.options.listTitle ? `lists/getByTitle('${formatting.encodeQueryParameter(args.options.listTitle)}')/` : '')}fields/CreateFieldAsXml`,
        headers: {
          'X-RequestDigest': reqDigest.FormDigestValue,
          accept: 'application/json;odata=nometadata'
        },
        data: {
          parameters: {
            SchemaXml: args.options.xml,
            Options: this.getOptions(args.options.options)
          }
        },
        responseType: 'json'
      };

      const res = await request.post<any>(requestOptions);
      logger.log(res);
    }
    catch (err: any) {
      this.handleRejectedODataJsonPromise(err);
    }
  }

  private getOptions(options?: string): number {
    let optionsValue: number = 0;

    if (!options) {
      return optionsValue;
    }

    options.split(',').forEach(o => {
      o = o.trim();
      switch (o) {
        case 'DefaultValue':
          optionsValue += 0;
          break;
        case 'AddToDefaultContentType':
          optionsValue += 1;
          break;
        case 'AddToNoContentType':
          optionsValue += 2;
          break;
        case 'AddToAllContentTypes':
          optionsValue += 4;
          break;
        case 'AddFieldInternalNameHint':
          optionsValue += 8;
          break;
        case 'AddFieldToDefaultView':
          optionsValue += 16;
          break;
        case 'AddFieldCheckDisplayName':
          optionsValue += 32;
          break;
      }
    });

    return optionsValue;
  }
}

module.exports = new SpoFieldAddCommand();