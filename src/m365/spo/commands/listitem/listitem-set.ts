import { Logger } from '../../../../cli/Logger';
import config from '../../../../config';
import GlobalOptions from '../../../../GlobalOptions';
import request from '../../../../request';
import { formatting } from '../../../../utils/formatting';
import { ClientSvcResponse, ClientSvcResponseContents, ContextInfo, spo } from '../../../../utils/spo';
import { validation } from '../../../../utils/validation';
import SpoCommand from '../../../base/SpoCommand';
import commands from '../../commands';
import { ListItemInstance } from './ListItemInstance';

interface CommandArgs {
  options: Options;
}

interface Options extends GlobalOptions {
  webUrl: string;
  listId?: string;
  listTitle?: string;
  id: string;
  contentType?: string;
  systemUpdate?: boolean;
}

class SpoListItemSetCommand extends SpoCommand {
  public allowUnknownOptions(): boolean | undefined {
    return true;
  }

  public get name(): string {
    return commands.LISTITEM_SET;
  }

  public get description(): string {
    return 'Updates a list item in the specified list';
  }

  constructor() {
    super();

    this.#initTelemetry();
    this.#initOptions();
    this.#initValidators();
    this.#initTypes();
    this.#initOptionSets();
  }

  #initTelemetry(): void {
    this.telemetry.push((args: CommandArgs) => {
      Object.assign(this.telemetryProperties, {
        listId: typeof args.options.listId !== 'undefined',
        listTitle: typeof args.options.listTitle !== 'undefined',
        contentType: typeof args.options.contentType !== 'undefined',
        systemUpdate: typeof args.options.systemUpdate !== 'undefined'
      });
    });
  }

  #initOptions(): void {
    this.options.unshift(
      {
        option: '-u, --webUrl <webUrl>'
      },
      {
        option: '-i, --id <id>'
      },
      {
        option: '-l, --listId [listId]'
      },
      {
        option: '-t, --listTitle [listTitle]'
      },
      {
        option: '-c, --contentType [contentType]'
      },
      {
        option: '-s, --systemUpdate'
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

        if (args.options.listId &&
          !validation.isValidGuid(args.options.listId)) {
          return `${args.options.listId} in option listId is not a valid GUID`;
        }

        return true;
      }
    );
  }

  #initTypes(): void {
    this.types.string.push(
      'webUrl',
      'listId',
      'listTitle',
      'id',
      'contentType'
    );
    this.types.boolean.push('systemUpdate');
  }

  #initOptionSets(): void {
    this.optionSets.push(['listId', 'listTitle']);
  }

  public async commandAction(logger: Logger, args: CommandArgs): Promise<void> {
    const listIdArgument = args.options.listId || '';
    const listTitleArgument = args.options.listTitle || '';
    const listRestUrl: string = (args.options.listId ?
      `${args.options.webUrl}/_api/web/lists(guid'${formatting.encodeQueryParameter(listIdArgument)}')`
      : `${args.options.webUrl}/_api/web/lists/getByTitle('${formatting.encodeQueryParameter(listTitleArgument)}')`);
    let contentTypeName: string = '';

    let formDigestValue: string = '';
    let environmentListId: string = '';

    try {
      if (args.options.systemUpdate) {
        if (this.verbose) {
          logger.logToStderr(`Getting list id...`);
        }

        const listRequestOptions: any = {
          url: `${listRestUrl}/id`,
          headers: {
            'accept': 'application/json;odata=nometadata'
          },
          responseType: 'json'
        };

        const dataReturned: any = await request.get(listRequestOptions);
        environmentListId = dataReturned.value;
      }
      
      if (args.options.contentType) {
        if (this.verbose) {
          logger.logToStderr(`Getting content types for list...`);
        }

        const requestOptions: any = {
          url: `${listRestUrl}/contenttypes?$select=Name,Id`,
          headers: {
            'accept': 'application/json;odata=nometadata'
          },
          responseType: 'json'
        };

        const contentTypes: any = await request.get(requestOptions);

        if (this.debug) {
          logger.logToStderr('content type lookup response...');
          logger.logToStderr(contentTypes);
        }

        const foundContentType: { Name: string; }[] = contentTypes.value.filter((ct: any) => {
          const contentTypeMatch: boolean = ct.Id.StringValue === args.options.contentType || ct.Name === args.options.contentType;

          if (this.debug) {
            logger.logToStderr(`Checking content type value [${ct.Name}]: ${contentTypeMatch}`);
          }

          return contentTypeMatch;
        });

        if (this.debug) {
          logger.logToStderr('content type filter output...');
          logger.logToStderr(foundContentType);
        }

        if (foundContentType.length > 0) {
          contentTypeName = foundContentType[0].Name;
        }

        // After checking for content types, throw an error if the name is blank
        if (!contentTypeName || contentTypeName === '') {
          throw `Specified content type '${args.options.contentType}' doesn't exist on the target list`;
        }

        if (this.debug) {
          logger.logToStderr(`using content type name: ${contentTypeName}`);
        }
      }

      let res: ContextInfo = undefined as any;

      if (args.options.systemUpdate) {
        if (this.debug) {
          logger.logToStderr(`getting request digest for systemUpdate request`);
        }

        res = await spo.getRequestDigest(args.options.webUrl);
      }

      if (this.verbose) {
        logger.logToStderr(`Updating item in list ${args.options.listId || args.options.listTitle} in site ${args.options.webUrl}...`);
      }

      formDigestValue = args.options.systemUpdate ? res['FormDigestValue'] : '';
      let objectIdentity: string = '';

      if (args.options.systemUpdate) {
        objectIdentity = await this.requestObjectIdentity(args.options.webUrl, logger, formDigestValue);
      }

      const additionalContentType: string = (args.options.systemUpdate && args.options.contentType && contentTypeName !== '') ? `
            <Parameters>
              <Parameter Type="String">ContentType</Parameter>
              <Parameter Type="String">${contentTypeName}</Parameter>
            </Parameters>`
        : ``;

      const requestBody: any = args.options.systemUpdate ?
        `<Request AddExpandoFieldTypeSuffix="true" SchemaVersion="15.0.0.0" LibraryVersion="16.0.0.0" ApplicationName="${config.applicationName}" xmlns="http://schemas.microsoft.com/sharepoint/clientquery/2009">
          <Actions>
            <Method Name="ParseAndSetFieldValue" Id="1" ObjectPathId="147">${this.mapRequestBody(args.options).join()}${additionalContentType}
            </Method>
            <Method Name="SystemUpdate" Id="2" ObjectPathId="147" />
          </Actions>
          <ObjectPaths>
            <Identity Id="147" Name="${objectIdentity}:list:${environmentListId}:item:${args.options.id},1" />
          </ObjectPaths>
        </Request>`
        : {
          formValues: this.mapRequestBody(args.options)
        };

      if (args.options.contentType && contentTypeName !== '' && !args.options.systemUpdate) {
        if (this.debug) {
          logger.logToStderr(`Specifying content type name [${contentTypeName}] in request body`);
        }

        requestBody.formValues.push({
          FieldName: 'ContentType',
          FieldValue: contentTypeName
        });
      }

      const requestOptions: any = args.options.systemUpdate ?
        {
          url: `${args.options.webUrl}/_vti_bin/client.svc/ProcessQuery`,
          headers: {
            'Content-Type': 'text/xml',
            'X-RequestDigest': formDigestValue
          },
          data: requestBody
        } :
        {
          url: `${listRestUrl}/items(${args.options.id})/ValidateUpdateListItem()`,
          headers: {
            'accept': 'application/json;odata=nometadata'
          },
          data: requestBody,
          responseType: 'json'
        };

      const response: any = await request.post(requestOptions);
      let itemId: number = 0;

      if (args.options.systemUpdate) {
        if (response.indexOf("ErrorMessage") > -1) {
          throw `Error occurred in systemUpdate operation - ${response}`;
        }
        else {
          itemId = Number(args.options.id);
        }
      }
      else {
        // Response is from /ValidateUpdateListItem POST call, perform get on updated item to get all field values
        const returnedData: any = response.value;

        if (!returnedData[0].ItemId) {
          throw `Item didn't update successfully`;
        }
        else {
          itemId = returnedData[0].ItemId;
        }
      }

      const requestOptionsItems: any = {
        url: `${listRestUrl}/items(${itemId})`,
        headers: {
          'accept': 'application/json;odata=nometadata'
        },
        responseType: 'json'
      };

      const itemsResponse = await request.get(requestOptionsItems);
      logger.log(<ListItemInstance>itemsResponse);

    } 
    catch (err: any) {
      this.handleRejectedODataJsonPromise(err);
    }
  }

  private mapRequestBody(options: Options): any {
    const requestBody: any = [];
    const excludeOptions: string[] = [
      'listTitle',
      'listId',
      'webUrl',
      'id',
      'contentType',
      'systemUpdate',
      'debug',
      'verbose',
      'output',
      's',
      'i',
      'o',
      'u',
      't',
      '_'
    ];

    Object.keys(options).forEach(key => {
      if (excludeOptions.indexOf(key) === -1) {
        if (options.systemUpdate) {
          requestBody.push(`
            <Parameters>
              <Parameter Type="String">${key}</Parameter>
              <Parameter Type="String">${(<any>options)[key].toString()}</Parameter>
            </Parameters>`);
        }
        else {
          requestBody.push({ FieldName: key, FieldValue: (<any>options)[key].toString() });
        }
      }
    });

    return requestBody;
  }

  /**
   * Requests web object identity for the current web.
   * This request has to be send before we can construct the property bag request.
   * The response data looks like:
   * _ObjectIdentity_=<GUID>|<GUID>:site:<GUID>:web:<GUID>
   * _ObjectType_=SP.Web
   * ServerRelativeUrl=/sites/contoso
   * The ObjectIdentity is needed to create another request to retrieve the property bag or set property.
   * @param webUrl web url
   * @param cmd command cmd
   */
  private requestObjectIdentity(webUrl: string, logger: Logger, formDigestValue: string): Promise<string> {
    const requestOptions: any = {
      url: `${webUrl}/_vti_bin/client.svc/ProcessQuery`,
      headers: {
        'X-RequestDigest': formDigestValue
      },
      data: `<Request AddExpandoFieldTypeSuffix="true" SchemaVersion="15.0.0.0" LibraryVersion="16.0.0.0" ApplicationName="${config.applicationName}" xmlns="http://schemas.microsoft.com/sharepoint/clientquery/2009"><Actions><Query Id="1" ObjectPathId="5"><Query SelectAllProperties="false"><Properties><Property Name="ServerRelativeUrl" ScalarProperty="true" /></Properties></Query></Query></Actions><ObjectPaths><Property Id="5" ParentId="3" Name="Web" /><StaticProperty Id="3" TypeId="{3747adcd-a3c3-41b9-bfab-4a64dd2f1e0a}" Name="Current" /></ObjectPaths></Request>`
    };

    return new Promise<string>((resolve: any, reject: any): void => {
      request.post(requestOptions).then((res: any) => {
        if (this.debug) {
          logger.logToStderr('Attempt to get _ObjectIdentity_ key values');
        }

        const json: ClientSvcResponse = JSON.parse(res);

        const contents: ClientSvcResponseContents = json.find(x => { return x['ErrorInfo']; });
        if (contents && contents.ErrorInfo) {
          reject(contents.ErrorInfo.ErrorMessage || 'ClientSvc unknown error');
        }

        const identityObject = json.find(x => { return x['_ObjectIdentity_']; });
        if (identityObject) {
          resolve(identityObject['_ObjectIdentity_']);
        }

        reject('Cannot proceed. _ObjectIdentity_ not found'); // this is not supposed to happen
      }).catch((err) => {
        reject(err);
      });
    });
  }
}

module.exports = new SpoListItemSetCommand();