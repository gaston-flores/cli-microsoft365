import { Logger } from '../../../../cli/Logger';
import GlobalOptions from '../../../../GlobalOptions';
import request from '../../../../request';
import { validation } from '../../../../utils/validation';
import GraphCommand from '../../../base/GraphCommand';
import commands from '../../commands';

interface CommandArgs {
  options: Options;
}

interface Options extends GlobalOptions {
  teamId: string;
  allowUserEditMessages?: string;
  allowUserDeleteMessages?: string;
  allowOwnerDeleteMessages?: string;
  allowTeamMentions?: string;
  allowChannelMentions?: string;
}

class TeamsMessagingSettingsSetCommand extends GraphCommand {
  private static props: string[] = [
    'allowUserEditMessages',
    'allowUserDeleteMessages',
    'allowOwnerDeleteMessages',
    'allowTeamMentions',
    'allowChannelMentions'
  ];

  public get name(): string {
    return commands.MESSAGINGSETTINGS_SET;
  }

  public get description(): string {
    return 'Updates messaging settings of a Microsoft Teams team';
  }

  constructor() {
    super();

    this.#initTelemetry();
    this.#initOptions();
    this.#initValidators();
  }

  #initTelemetry(): void {
    this.telemetry.push((args: CommandArgs) => {
      TeamsMessagingSettingsSetCommand.props.forEach((p: string) => {
        this.telemetryProperties[p] = typeof (args.options as any)[p] !== 'undefined';
      });
    });
  }

  #initOptions(): void {
    this.options.unshift(
      {
        option: '-i, --teamId <teamId>'
      },
      {
        option: '--allowUserEditMessages [allowUserEditMessages]'
      },
      {
        option: '--allowUserDeleteMessages [allowUserDeleteMessages]'
      },
      {
        option: '--allowOwnerDeleteMessages [allowOwnerDeleteMessages]'
      },
      {
        option: '--allowTeamMentions [allowTeamMentions]'
      },
      {
        option: '--allowChannelMentions [allowChannelMentions]'
      }
    );
  }

  #initValidators(): void {
    this.validators.push(
      async (args: CommandArgs) => {
        if (!validation.isValidGuid(args.options.teamId)) {
          return `${args.options.teamId} is not a valid GUID`;
        }

        let hasDuplicate: boolean = false;
        let property: string = '';
        TeamsMessagingSettingsSetCommand.props.forEach((prop: string) => {
          if ((args.options as any)[prop] instanceof Array) {
            property = prop;
            hasDuplicate = true;
          }
        });
        if (hasDuplicate) {
          return `Duplicate option ${property} specified. Specify only one`;
        }

        let isValid: boolean = true;
        let value: string = '';
        TeamsMessagingSettingsSetCommand.props.every((p: string) => {
          property = p;
          value = (args.options as any)[p];
          isValid = typeof value === 'undefined' || validation.isValidBoolean(value);
          return isValid;
        });
        if (!isValid) {
          return `Value ${value} for option ${property} is not a valid boolean`;
        }

        return true;
      }
    );
  }

  public async commandAction(logger: Logger, args: CommandArgs): Promise<void> {
    const data: any = {
      messagingSettings: {}
    };
    TeamsMessagingSettingsSetCommand.props.forEach((p: string) => {
      if (typeof (args.options as any)[p] !== 'undefined') {
        data.messagingSettings[p] = (args.options as any)[p].toLowerCase() === 'true';
      }
    });

    const requestOptions: any = {
      url: `${this.resource}/v1.0/teams/${encodeURIComponent(args.options.teamId)}`,
      headers: {
        accept: 'application/json;odata.metadata=none'
      },
      data: data,
      responseType: 'json'
    };

    try {
      await request.patch(requestOptions);
    } 
    catch (err: any) {
      this.handleRejectedODataJsonPromise(err);
    }
  }
}

module.exports = new TeamsMessagingSettingsSetCommand();