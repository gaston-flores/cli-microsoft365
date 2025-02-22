import { Post } from '@microsoft/microsoft-graph-types';
import { Logger } from '../../../../cli/Logger';
import GlobalOptions from '../../../../GlobalOptions';
import { odata } from '../../../../utils/odata';
import { validation } from '../../../../utils/validation';
import { aadGroup } from '../../../../utils/aadGroup';
import GraphCommand from '../../../base/GraphCommand';
import commands from '../../commands';

interface CommandArgs {
  options: Options;
}

interface Options extends GlobalOptions {
  groupId?: string;
  groupDisplayName?: string;
  threadId: string;
}

class AadO365GroupConversationPostListCommand extends GraphCommand {
  public get name(): string {
    return commands.O365GROUP_CONVERSATION_POST_LIST;
  }

  public get description(): string {
    return 'Lists conversation posts of a Microsoft 365 group';
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
        groupId: typeof args.options.groupId !== 'undefined',
        groupDisplayName: typeof args.options.groupDisplayName !== 'undefined'
      });
    });
  }

  #initOptions(): void {
    this.options.unshift(
      {
        option: '-i, --groupId [groupId]'
      },
      {
        option: '-d, --groupDisplayName [groupDisplayName]'
      },
      {
        option: '-t, --threadId <threadId>'
      }
    );
  }

  #initValidators(): void {
    this.validators.push(
      async (args: CommandArgs) => {
        if (args.options.groupId && !validation.isValidGuid(args.options.groupId as string)) {
          return `${args.options.groupId} is not a valid GUID`;
        }
    
        return true;
      }
    );
  }

  #initOptionSets(): void {
    this.optionSets.push(['groupId', 'groupDisplayName']);
  }

  public defaultProperties(): string[] | undefined {
    return ['receivedDateTime', 'id'];
  }

  public async commandAction(logger: Logger, args: CommandArgs): Promise<void> {
    try {
      const retrievedgroupId = await this.getGroupId(args);
      const posts = await odata.getAllItems<Post>(`${this.resource}/v1.0/groups/${retrievedgroupId}/threads/${args.options.threadId}/posts`);
      logger.log(posts);
    }
    catch (err: any) {
      this.handleRejectedODataJsonPromise(err);
    }
  }

  private getGroupId(args: CommandArgs): Promise<string> {
    if (args.options.groupId) {
      return Promise.resolve(encodeURIComponent(args.options.groupId));
    }

    return aadGroup
      .getGroupByDisplayName(args.options.groupDisplayName!)
      .then(group => group.id!);
  }
}

module.exports = new AadO365GroupConversationPostListCommand();