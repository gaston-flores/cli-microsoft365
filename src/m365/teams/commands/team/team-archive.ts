import { Group } from '@microsoft/microsoft-graph-types';
import { Logger } from '../../../../cli/Logger';
import GlobalOptions from '../../../../GlobalOptions';
import request from '../../../../request';
import { validation } from '../../../../utils/validation';
import { aadGroup } from '../../../../utils/aadGroup';
import GraphCommand from '../../../base/GraphCommand';
import commands from '../../commands';

interface ExtendedGroup extends Group {
  resourceProvisioningOptions: string[];
}

interface CommandArgs {
  options: Options;
}

interface Options extends GlobalOptions {
  id?: string;
  name?: string;
  teamId?: string;
  shouldSetSpoSiteReadOnlyForMembers: boolean;
}

class TeamsTeamArchiveCommand extends GraphCommand {
  public get name(): string {
    return commands.TEAM_ARCHIVE;
  }

  public get description(): string {
    return 'Archives specified Microsoft Teams team';
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
      	id: typeof args.options.id !== 'undefined',
      	name: typeof args.options.name !== 'undefined',
        shouldSetSpoSiteReadOnlyForMembers: args.options.shouldSetSpoSiteReadOnlyForMembers === true,
        teamId: typeof args.options.teamId !== 'undefined'
      });
    });
  }

  #initOptions(): void {
    this.options.unshift(
      {
        option: '-i, --id [id]'
      },
      {
        option: '-n, --name [name]'
      },
      {
        option: '--teamId [teamId]'
      },
      {
        option: '--shouldSetSpoSiteReadOnlyForMembers'
      }
    );
  }

  #initValidators(): void {
    this.validators.push(
      async (args: CommandArgs) => {
        if (!args.options.id && !args.options.name && !args.options.teamId) {
	      return 'Specify either id or name';
	    }

	    if (args.options.name && (args.options.id || args.options.teamId)) {
	      return 'Specify either id or name but not both';
	    }

	    if (args.options.teamId && !validation.isValidGuid(args.options.teamId)) {
	      return `${args.options.teamId} is not a valid GUID`;
	    }

	    if (args.options.id && !validation.isValidGuid(args.options.id)) {
	      return `${args.options.id} is not a valid GUID`;
	    }

	    return true;
      }
    );
  }

  private getTeamId(args: CommandArgs): Promise<string> {
    if (args.options.id) {
      return Promise.resolve(args.options.id);
    }

    return aadGroup
      .getGroupByDisplayName(args.options.name!)
      .then(group => {
        if ((group as ExtendedGroup).resourceProvisioningOptions.indexOf('Team') === -1) {
          return Promise.reject(`The specified team does not exist in the Microsoft Teams`);
        }

        return group.id!;
      });
  }

  public async commandAction(logger: Logger, args: CommandArgs): Promise<void> {
    if (args.options.teamId) {
      args.options.id = args.options.teamId;

      this.warn(logger, `Option 'teamId' is deprecated. Please use 'id' instead.`);
    }

    const siteReadOnlyForMembers: boolean = args.options.shouldSetSpoSiteReadOnlyForMembers === true;

    try {
      const teamId: string = await this.getTeamId(args);
      const requestOptions: any = {
        url: `${this.resource}/v1.0/teams/${encodeURIComponent(teamId)}/archive`,
        headers: {
          'content-type': 'application/json;odata=nometadata',
          'accept': 'application/json;odata.metadata=none'
        },
        responseType: 'json',
        data: {
          shouldSetSpoSiteReadOnlyForMembers: siteReadOnlyForMembers
        }
      };

      await request.post(requestOptions);
    } 
    catch (err: any) {
      this.handleRejectedODataJsonPromise(err);
    }
  }
}

module.exports = new TeamsTeamArchiveCommand();