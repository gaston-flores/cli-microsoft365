import { Channel, Group } from '@microsoft/microsoft-graph-types';
import { Cli } from '../../../../cli/Cli';
import { Logger } from '../../../../cli/Logger';
import GlobalOptions from '../../../../GlobalOptions';
import request from '../../../../request';
import { validation } from '../../../../utils/validation';
import { aadGroup } from '../../../../utils/aadGroup';
import GraphCommand from '../../../base/GraphCommand';
import commands from '../../commands';
import { ConversationMember } from '../../ConversationMember';

interface ExtendedGroup extends Group {
  resourceProvisioningOptions: string[];
}

interface CommandArgs {
  options: Options;
}

interface Options extends GlobalOptions {
  teamId?: string;
  teamName?: string;
  channelId?: string;
  channelName?: string;
  userName?: string;
  userId?: string;
  id?: string;
  confirm?: boolean;
}

class TeamsChannelMemberRemoveCommand extends GraphCommand {
  private teamId: string = '';
  private channelId: string = '';

  public get name(): string {
    return commands.CHANNEL_MEMBER_REMOVE;
  }

  public get description(): string {
    return 'Remove the specified member from the specified Microsoft Teams private or shared team channel';
  }

  public alias(): string[] | undefined {
    return [commands.CONVERSATIONMEMBER_REMOVE];
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
        teamId: typeof args.options.teamId !== 'undefined',
        teamName: typeof args.options.teamName !== 'undefined',
        channelId: typeof args.options.channelId !== 'undefined',
        channelName: typeof args.options.channelName !== 'undefined',
        userName: typeof args.options.userName !== 'undefined',
        userId: typeof args.options.userId !== 'undefined',
        id: typeof args.options.id !== 'undefined',
        confirm: (!(!args.options.confirm)).toString()
      });
    });
  }

  #initOptions(): void {
    this.options.unshift(
      {
        option: '--teamId [teamId]'
      },
      {
        option: '--teamName [teamName]'
      },
      {
        option: '--channelId [channelId]'
      },
      {
        option: '--channelName [channelName]'
      },
      {
        option: '--userName [userName]'
      },
      {
        option: '--userId [userId]'
      },
      {
        option: '--id [id]'
      },
      {
        option: '--confirm'
      }
    );
  }

  #initValidators(): void {
    this.validators.push(
      async (args: CommandArgs) => {
        if (args.options.teamId && !validation.isValidGuid(args.options.teamId)) {
          return `${args.options.teamId} is not a valid GUID`;
        }

        if (args.options.channelId && !validation.isValidTeamsChannelId(args.options.channelId)) {
          return `${args.options.channelId} is not a valid Teams Channel ID`;
        }

        if (args.options.userId && !validation.isValidGuid(args.options.userId)) {
          return `${args.options.userId} is not a valid GUID`;
        }

        return true;
      }
    );
  }

  #initOptionSets(): void {
    this.optionSets.push(
      ['teamId', 'teamName'],
      ['channelId', 'channelName'],
      ['userId', 'userName', 'id']
    );
  }

  public async commandAction(logger: Logger, args: CommandArgs): Promise<void> {
    this.showDeprecationWarning(logger, commands.CONVERSATIONMEMBER_REMOVE, commands.CHANNEL_MEMBER_REMOVE);

    const removeMember: () => Promise<void> = async (): Promise<void> => {
      try {
        await this.removeMemberFromChannel(args);
      } 
      catch (err: any) {
        this.handleRejectedODataJsonPromise(err);
      }
    };

    if (args.options.confirm) {
      await removeMember();
    }
    else {
      const userName = args.options.userName || args.options.userId || args.options.id;
      const teamName = args.options.teamName || args.options.teamId;
      const channelName = args.options.channelName || args.options.channelId;
      const result = await Cli.prompt<{ continue: boolean }>({
        type: 'confirm',
        name: 'continue',
        default: false,
        message: `Are you sure you want to remove the member ${userName} from the channel ${channelName} in team ${teamName}?`
      });
      
      if (result.continue) {
        await removeMember();
      }
    }
  }

  private removeMemberFromChannel(args: CommandArgs): Promise<void> {
    return this
      .getTeamId(args)
      .then((teamId: string): Promise<string> => {
        this.teamId = teamId;
        return this.getChannelId(args);
      })
      .then((channelId: string): Promise<string> => {
        this.channelId = channelId;
        return this.getMemberId(args);
      })
      .then((memberId: string) => {
        const requestOptions: any = {
          url: `${this.resource}/v1.0/teams/${this.teamId}/channels/${this.channelId}/members/${memberId}`,
          headers: {
            'accept': 'application/json;odata.metadata=none'
          },
          responseType: 'json'
        };

        return request.delete(requestOptions);
      });
  }

  private getTeamId(args: CommandArgs): Promise<string> {
    if (args.options.teamId) {
      return Promise.resolve(args.options.teamId);
    }

    return aadGroup
      .getGroupByDisplayName(args.options.teamName!)
      .then(group => {
        if ((group as ExtendedGroup).resourceProvisioningOptions.indexOf('Team') === -1) {
          return Promise.reject(`The specified team does not exist in the Microsoft Teams`);
        }

        return group.id!;
      });
  }

  private getChannelId(args: CommandArgs): Promise<string> {
    if (args.options.channelId) {
      return Promise.resolve(args.options.channelId);
    }

    const requestOptions: any = {
      url: `${this.resource}/v1.0/teams/${encodeURIComponent(this.teamId)}/channels?$filter=displayName eq '${encodeURIComponent(args.options.channelName as string)}'`,
      headers: {
        accept: 'application/json;odata.metadata=none'
      },
      responseType: 'json'
    };

    return request
      .get<{ value: Channel[] }>(requestOptions)
      .then(response => {
        const channelItem: Channel | undefined = response.value[0];

        if (!channelItem) {
          return Promise.reject(`The specified channel does not exist in the Microsoft Teams team`);
        }

        if (channelItem.membershipType !== "private") {
          return Promise.reject(`The specified channel is not a private channel`);
        }

        return Promise.resolve(channelItem.id!);
      });
  }

  private getMemberId(args: CommandArgs): Promise<string> {
    if (args.options.id) {
      return Promise.resolve(args.options.id);
    }

    const requestOptions: any = {
      url: `${this.resource}/v1.0/teams/${this.teamId}/channels/${this.channelId}/members`,
      headers: {
        accept: 'application/json;odata.metadata=none'
      },
      responseType: 'json'
    };

    return request
      .get<{ value: ConversationMember[] }>(requestOptions)
      .then(response => {
        const conversationMembers = response.value.filter(x =>
          args.options.userId && x.userId?.toLocaleLowerCase() === args.options.userId.toLocaleLowerCase() ||
          args.options.userName && x.email?.toLocaleLowerCase() === args.options.userName.toLocaleLowerCase()
        );

        const conversationMember: ConversationMember | undefined = conversationMembers[0];

        if (!conversationMember) {
          return Promise.reject(`The specified member does not exist in the Microsoft Teams channel`);
        }

        if (conversationMembers.length > 1) {
          return Promise.reject(`Multiple Microsoft Teams channel members with name ${args.options.userName} found: ${response.value.map(x => x.userId)}`);
        }

        return Promise.resolve(conversationMember.id);
      });
  }
}

module.exports = new TeamsChannelMemberRemoveCommand();