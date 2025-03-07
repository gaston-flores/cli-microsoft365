import * as chalk from 'chalk';
import * as child_process from 'child_process';
import { satisfies } from 'semver';
import { Logger } from '../../../cli/Logger';
import GlobalOptions from '../../../GlobalOptions';
import AnonymousCommand from '../../base/AnonymousCommand';
import commands from '../commands';

interface CommandArgs {
  options: Options;
}

interface Options extends GlobalOptions {
  env?: string;
}

/**
 * Has the particular check passed or failed
 */
enum CheckStatus {
  Success,
  Failure
}

/**
 * Where to search for the particular npm package: only in the current project,
 * in global packages or both
 */
enum PackageSearchMode {
  LocalOnly,
  GlobalOnly,
  LocalAndGlobal
}

/**
 * Is the particular check optional or required
 */
enum OptionalOrRequired {
  Optional,
  Required
}

/**
 * Should the method continue or fail on a rejected Promise
 */
enum HandlePromise {
  Fail,
  Continue
}

interface VersionCheck {
  /**
   * Required version range in semver
   */
  range: string;
  /**
   * What to do to fix it if the required range isn't met
   */
  fix: string;
}

/**
 * Versions of SharePoint that support SharePoint Framework
 */
enum SharePointVersion {
  SP2016 = 1 << 0,
  SP2019 = 1 << 1,
  SPO = 1 << 2,
  All = ~(~0 << 3)
}

interface SpfxVersionPrerequisites {
  gulpCli: VersionCheck;
  node: VersionCheck;
  sp: SharePointVersion;
  yo: VersionCheck;
}

class SpfxDoctorCommand extends AnonymousCommand {
  private readonly versions: { [version: string]: SpfxVersionPrerequisites } = {
    '1.0.0': {
      gulpCli: {
        range: '^1 || ^2',
        fix: 'npm i -g gulp-cli@2'
      },
      node: {
        range: '^6',
        fix: 'Install Node.js v6'
      },
      sp: SharePointVersion.All,
      yo: {
        range: '^3',
        fix: 'npm i -g yo@3'
      }
    },
    '1.1.0': {
      gulpCli: {
        range: '^1 || ^2',
        fix: 'npm i -g gulp-cli@2'
      },
      node: {
        range: '^6',
        fix: 'Install Node.js v6'
      },
      sp: SharePointVersion.All,
      yo: {
        range: '^3',
        fix: 'npm i -g yo@3'
      }
    },
    '1.2.0': {
      gulpCli: {
        range: '^1 || ^2',
        fix: 'npm i -g gulp-cli@2'
      },
      node: {
        range: '^6',
        fix: 'Install Node.js v6'
      },
      sp: SharePointVersion.SP2019 | SharePointVersion.SPO,
      yo: {
        range: '^3',
        fix: 'npm i -g yo@3'
      }
    },
    '1.4.0': {
      gulpCli: {
        range: '^1 || ^2',
        fix: 'npm i -g gulp-cli@2'
      },
      node: {
        range: '^6',
        fix: 'Install Node.js v6'
      },
      sp: SharePointVersion.SP2019 | SharePointVersion.SPO,
      yo: {
        range: '^3',
        fix: 'npm i -g yo@3'
      }
    },
    '1.4.1': {
      gulpCli: {
        range: '^1 || ^2',
        fix: 'npm i -g gulp-cli@2'
      },
      node: {
        range: '^6 || ^8',
        fix: 'Install Node.js v8'
      },
      sp: SharePointVersion.SP2019 | SharePointVersion.SPO,
      yo: {
        range: '^3',
        fix: 'npm i -g yo@3'
      }
    },
    '1.5.0': {
      gulpCli: {
        range: '^1 || ^2',
        fix: 'npm i -g gulp-cli@2'
      },
      node: {
        range: '^6 || ^8',
        fix: 'Install Node.js v8'
      },
      sp: SharePointVersion.SPO,
      yo: {
        range: '^3',
        fix: 'npm i -g yo@3'
      }
    },
    '1.5.1': {
      gulpCli: {
        range: '^1 || ^2',
        fix: 'npm i -g gulp-cli@2'
      },
      node: {
        range: '^6 || ^8',
        fix: 'Install Node.js v8'
      },
      sp: SharePointVersion.SPO,
      yo: {
        range: '^3',
        fix: 'npm i -g yo@3'
      }
    },
    '1.6.0': {
      gulpCli: {
        range: '^1 || ^2',
        fix: 'npm i -g gulp-cli@2'
      },
      node: {
        range: '^6 || ^8',
        fix: 'Install Node.js v8'
      },
      sp: SharePointVersion.SPO,
      yo: {
        range: '^3',
        fix: 'npm i -g yo@3'
      }
    },
    '1.7.0': {
      gulpCli: {
        range: '^1 || ^2',
        fix: 'npm i -g gulp-cli@2'
      },
      node: {
        range: '^8',
        fix: 'Install Node.js v8'
      },
      sp: SharePointVersion.SPO,
      yo: {
        range: '^3',
        fix: 'npm i -g yo@3'
      }
    },
    '1.7.1': {
      gulpCli: {
        range: '^1 || ^2',
        fix: 'npm i -g gulp-cli@2'
      },
      node: {
        range: '^8',
        fix: 'Install Node.js v8'
      },
      sp: SharePointVersion.SPO,
      yo: {
        range: '^3',
        fix: 'npm i -g yo@3'
      }
    },
    '1.8.0': {
      gulpCli: {
        range: '^1 || ^2',
        fix: 'npm i -g gulp-cli@2'
      },
      node: {
        range: '^8',
        fix: 'Install Node.js v8'
      },
      sp: SharePointVersion.SPO,
      yo: {
        range: '^3',
        fix: 'npm i -g yo@3'
      }
    },
    '1.8.1': {
      gulpCli: {
        range: '^1 || ^2',
        fix: 'npm i -g gulp-cli@2'
      },
      node: {
        range: '^8',
        fix: 'Install Node.js v8'
      },
      sp: SharePointVersion.SPO,
      yo: {
        range: '^3',
        fix: 'npm i -g yo@3'
      }
    },
    '1.8.2': {
      gulpCli: {
        range: '^1 || ^2',
        fix: 'npm i -g gulp-cli@2'
      },
      node: {
        range: '^8 || ^10',
        fix: 'Install Node.js v10'
      },
      sp: SharePointVersion.SPO,
      yo: {
        range: '^3',
        fix: 'npm i -g yo@3'
      }
    },
    '1.9.0': {
      gulpCli: {
        range: '^1 || ^2',
        fix: 'npm i -g gulp-cli@2'
      },
      node: {
        range: '^8 || ^10',
        fix: 'Install Node.js v10'
      },
      sp: SharePointVersion.SPO,
      yo: {
        range: '^3',
        fix: 'npm i -g yo@3'
      }
    },
    '1.9.1': {
      gulpCli: {
        range: '^1 || ^2',
        fix: 'npm i -g gulp-cli@2'
      },
      node: {
        range: '^10',
        fix: 'Install Node.js v10'
      },
      sp: SharePointVersion.SPO,
      yo: {
        range: '^3',
        fix: 'npm i -g yo@3'
      }
    },
    '1.10.0': {
      gulpCli: {
        range: '^1 || ^2',
        fix: 'npm i -g gulp-cli@2'
      },
      node: {
        range: '^10',
        fix: 'Install Node.js v10'
      },
      sp: SharePointVersion.SPO,
      yo: {
        range: '^3',
        fix: 'npm i -g yo@3'
      }
    },
    '1.11.0': {
      gulpCli: {
        range: '^1 || ^2',
        fix: 'npm i -g gulp-cli@2'
      },
      node: {
        range: '^10',
        fix: 'Install Node.js v10'
      },
      sp: SharePointVersion.SPO,
      yo: {
        range: '^3',
        fix: 'npm i -g yo@3'
      }
    },
    '1.12.0': {
      gulpCli: {
        range: '^1 || ^2',
        fix: 'npm i -g gulp-cli@2'
      },
      node: {
        range: '^12',
        fix: 'Install Node.js v12'
      },
      sp: SharePointVersion.SPO,
      yo: {
        range: '^3',
        fix: 'npm i -g yo@3'
      }
    },
    '1.12.1': {
      gulpCli: {
        range: '^1 || ^2',
        fix: 'npm i -g gulp-cli@2'
      },
      node: {
        range: '^12 || ^14',
        fix: 'Install Node.js v12 or v14'
      },
      sp: SharePointVersion.SPO,
      yo: {
        range: '^3',
        fix: 'npm i -g yo@3'
      }
    },
    '1.13.0': {
      gulpCli: {
        range: '^1 || ^2',
        fix: 'npm i -g gulp-cli@2'
      },
      node: {
        range: '^12 || ^14',
        fix: 'Install Node.js v12 or v14'
      },
      sp: SharePointVersion.SPO,
      yo: {
        range: '^4',
        fix: 'npm i -g yo@4'
      }
    },
    '1.13.1': {
      gulpCli: {
        range: '^1 || ^2',
        fix: 'npm i -g gulp-cli@2'
      },
      node: {
        range: '^12 || ^14',
        fix: 'Install Node.js v12 or v14'
      },
      sp: SharePointVersion.SPO,
      yo: {
        range: '^4',
        fix: 'npm i -g yo@4'
      }
    },
    '1.14.0': {
      gulpCli: {
        range: '^1 || ^2',
        fix: 'npm i -g gulp-cli@2'
      },
      node: {
        range: '^12 || ^14',
        fix: 'Install Node.js v12 or v14'
      },
      sp: SharePointVersion.SPO,
      yo: {
        range: '^4',
        fix: 'npm i -g yo@4'
      }
    },
    '1.15.0': {
      gulpCli: {
        range: '^1 || ^2',
        fix: 'npm i -g gulp-cli@2'
      },
      node: {
        range: '^12.13 || ^14.15 || ^16.13',
        fix: 'Install Node.js v12.13, v14.15, v16.13 or higher'
      },
      sp: SharePointVersion.SPO,
      yo: {
        range: '^4',
        fix: 'npm i -g yo@4'
      }
    },
    '1.15.2': {
      gulpCli: {
        range: '^1 || ^2',
        fix: 'npm i -g gulp-cli@2'
      },
      node: {
        range: '^12.13 || ^14.15 || ^16.13',
        fix: 'Install Node.js v12.13, v14.15, v16.13 or higher'
      },
      sp: SharePointVersion.SPO,
      yo: {
        range: '^4',
        fix: 'npm i -g yo@4'
      }
    },
    '1.16.0-beta.1': {
      gulpCli: {
        range: '^1 || ^2',
        fix: 'npm i -g gulp-cli@2'
      },
      node: {
        range: '^16.13',
        fix: 'Install Node.js v16.13 or higher'
      },
      sp: SharePointVersion.SPO,
      yo: {
        range: '^4',
        fix: 'npm i -g yo@4'
      }
    }
  };


  public get name(): string {
    return commands.DOCTOR;
  }

  public get description(): string {
    return 'Verifies environment configuration for using the specific version of the SharePoint Framework';
  }

  constructor() {
    super();

    this.#initTelemetry();
    this.#initOptions();
    this.#initValidators();
    this.#initTypes();
  }

  #initTelemetry(): void {
    this.telemetry.push((args: CommandArgs) => {
      Object.assign(this.telemetryProperties, {
        env: args.options.env
      });
    });
  }

  #initOptions(): void {
    this.options.unshift(
      {
        option: '-e, --env [env]',
        autocomplete: ['sp2016', 'sp2019', 'spo']
      }
    );
  }

  #initValidators(): void {
    this.validators.push(
      async (args: CommandArgs) => {
        if (args.options.env) {
          const sp: SharePointVersion | undefined = this.spVersionStringToEnum(args.options.env);
          if (!sp) {
            return `${args.options.env} is not a valid SharePoint version. Valid versions are sp2016, sp2019 or spo`;
          }
        }

        if (args.options.output && args.options.output !== 'text') {
          return `The output option only accepts the type 'text'`;
        }

        return true;
      }
    );
  }

  #initTypes(): void {
    this.types.string.push('e', 'env');
  }

  public async commandAction(logger: Logger, args: CommandArgs): Promise<void> {
    if (!args.options.output) {
      args.options.output = 'text';
    }

    logger.log(' ');
    logger.log('CLI for Microsoft 365 SharePoint Framework doctor');
    logger.log('Verifying configuration of your system for working with the SharePoint Framework');
    logger.log(' ');

    let spfxVersion: string = '';
    let prerequisites: SpfxVersionPrerequisites;
    const fixes: string[] = [];
    
    try {
      spfxVersion = await this.getSharePointFrameworkVersion(logger);

      if (!spfxVersion) {
        logger.log(this.getStatus(CheckStatus.Failure, `SharePoint Framework`));
        throw `SharePoint Framework not found`;
      }

      prerequisites = this.versions[spfxVersion];
      if (!prerequisites) {
        logger.log(this.getStatus(CheckStatus.Failure, `SharePoint Framework v${spfxVersion}`));
        throw `spfx doctor doesn't support SPFx v${spfxVersion} at this moment`;
      }

      logger.log(this.getStatus(CheckStatus.Success, `SharePoint Framework v${spfxVersion}`));

      await this.checkSharePointCompatibility(spfxVersion, prerequisites, args, fixes, logger);
      await this.checkNodeVersion(prerequisites, fixes, logger);
      await this.checkYo(prerequisites, fixes, logger);
      await this.checkGulp(fixes, logger);
      await this.checkGulpCli(prerequisites, fixes, logger);
      await this.checkTypeScript(fixes, logger);

      if (fixes.length > 0) {
        logger.log(' ');
        logger.log('Recommended fixes:');
        logger.log(' ');
        fixes.forEach(f => logger.log(`- ${f}`));
        logger.log(' ');
      }
    } 
    catch (err: any) {
      logger.log(' ');

      if (fixes.length > 0) {
        logger.log('Recommended fixes:');
        logger.log(' ');
        fixes.forEach(f => logger.log(`- ${f}`));
        logger.log(' ');
      }
      this.handleRejectedPromise(err);
    }
  }

  private checkSharePointCompatibility(spfxVersion: string, prerequisites: SpfxVersionPrerequisites, args: CommandArgs, fixes: string[], logger: Logger): Promise<void> {
    return new Promise<void>((resolve: () => void, reject: (error: string) => void): void => {
      if (args.options.env) {
        const sp: SharePointVersion = this.spVersionStringToEnum(args.options.env) as SharePointVersion;
        if ((prerequisites.sp & sp) === sp) {
          logger.log(this.getStatus(CheckStatus.Success, `Supported in ${SharePointVersion[sp]}`));
          resolve();
        }
        else {
          logger.log(this.getStatus(CheckStatus.Failure, `Not supported in ${SharePointVersion[sp]}`));
          fixes.push(`Use SharePoint Framework v${(sp === SharePointVersion.SP2016 ? '1.1' : '1.4.1')}`);
          reject(`SharePoint Framework v${spfxVersion} is not supported in ${SharePointVersion[sp]}`);
        }
      }
      else {
        resolve();
      }
    });
  }

  private checkNodeVersion(prerequisites: SpfxVersionPrerequisites, fixes: string[], logger: Logger): Promise<void> {
    return Promise
      .resolve(this.getNodeVersion())
      .then((nodeVersion: string): void => {
        this.checkStatus('Node', nodeVersion, prerequisites.node, OptionalOrRequired.Required, fixes, logger);
      });
  }

  private checkYo(prerequisites: SpfxVersionPrerequisites, fixes: string[], logger: Logger): Promise<void> {
    return this
      .getPackageVersion('yo', PackageSearchMode.GlobalOnly, HandlePromise.Continue, logger)
      .then((yoVersion: string): void => {
        if (yoVersion) {
          this.checkStatus('yo', yoVersion, prerequisites.yo, OptionalOrRequired.Required, fixes, logger);
        }
        else {
          logger.log(this.getStatus(CheckStatus.Failure, `yo not found`));
          fixes.push(prerequisites.yo.fix);
        }
      });
  }

  private checkGulpCli(prerequisites: SpfxVersionPrerequisites, fixes: string[], logger: Logger): Promise<void> {
    return this
      .getPackageVersion('gulp-cli', PackageSearchMode.GlobalOnly, HandlePromise.Continue, logger)
      .then((gulpCliVersion: string): void => {
        if (gulpCliVersion) {
          this.checkStatus('gulp-cli', gulpCliVersion, prerequisites.gulpCli, OptionalOrRequired.Required, fixes, logger);
        }
        else {
          logger.log(this.getStatus(CheckStatus.Failure, `gulp-cli not found`));
          fixes.push(prerequisites.gulpCli.fix);
        }
      });
  }

  private checkGulp(fixes: string[], logger: Logger): Promise<void> {
    return this
      .getPackageVersion('gulp', PackageSearchMode.GlobalOnly, HandlePromise.Continue, logger)
      .then((gulpVersion: string): void => {
        if (gulpVersion) {
          logger.log(this.getStatus(CheckStatus.Failure, `gulp should be removed`));
          fixes.push('npm un -g gulp');
        }
      });
  }

  private checkTypeScript(fixes: string[], logger: Logger): Promise<void> {
    return this
      .getPackageVersion('typescript', PackageSearchMode.LocalOnly, HandlePromise.Continue, logger)
      .then((typeScriptVersion: string): void => {
        if (typeScriptVersion) {
          logger.log(this.getStatus(CheckStatus.Failure, `typescript v${typeScriptVersion} installed in the project`));
          fixes.push('npm un typescript');
        }
        else {
          logger.log(this.getStatus(CheckStatus.Success, `bundled typescript used`));
        }
      });
  }

  private spVersionStringToEnum(sp: string): SharePointVersion | undefined {
    return (<any>SharePointVersion)[sp.toUpperCase()];
  }

  private getSharePointFrameworkVersion(logger: Logger): Promise<string> {
    return new Promise<string>((resolve: (version: string) => void, reject: (error: string) => void): void => {
      if (this.debug) {
        logger.logToStderr('Detecting SharePoint Framework version based on @microsoft/sp-core-library local...');
      }

      this
        .getPackageVersion('@microsoft/sp-core-library', PackageSearchMode.LocalOnly, HandlePromise.Fail, logger)
        .then((version: string): Promise<string> => {
          if (this.debug) {
            logger.logToStderr(`Found @microsoft/sp-core-library@${version}`);
          }

          return Promise.resolve(version);
        })
        .catch((): Promise<string> => {
          if (this.debug) {
            logger.logToStderr(`@microsoft/sp-core-library not found. Search for @microsoft/generator-sharepoint local or global...`);
          }

          return this.getPackageVersion('@microsoft/generator-sharepoint', PackageSearchMode.LocalAndGlobal, HandlePromise.Fail, logger);
        })
        .then((version: string): void => {
          resolve(version);
        })
        .catch((error?: string): void => {
          if (this.debug) {
            logger.logToStderr('@microsoft/generator-sharepoint not found');
          }

          if (error && error.indexOf('ENOENT') > -1) {
            reject('npm not found');
          }
          else {
            resolve('');
          }
        });
    });
  }

  private getPackageVersion(packageName: string, searchMode: PackageSearchMode, handlePromise: HandlePromise, logger: Logger): Promise<string> {
    return new Promise<string>((resolve: (version: string) => void, reject: (err?: any) => void): void => {
      const args: string[] = ['ls', packageName, '--depth=0', '--json'];
      if (searchMode === PackageSearchMode.GlobalOnly) {
        args.push('-g');
      }

      this
        .getPackageVersionFromNpm(args, logger)
        .then((version: string): Promise<string> => {
          return Promise.resolve(version);
        })
        .catch((): Promise<string> => {
          if (searchMode === PackageSearchMode.LocalAndGlobal) {
            args.push('-g');
            return this.getPackageVersionFromNpm(args, logger);
          }
          else {
            return Promise.resolve('');
          }
        })
        .then((version: string): void => {
          if (version) {
            resolve(version);
          }
          else {
            if (handlePromise === HandlePromise.Continue) {
              resolve('');
            }
            else {
              reject();
            }
          }
        })
        .catch((err: string): void => {
          reject(err);
        });
    });
  }

  private getPackageVersionFromNpm(args: string[], logger: Logger): Promise<string> {
    return new Promise<string>((resolve: (version: string) => void, reject: (error: string) => void): void => {
      const packageName: string = args[1];

      if (this.debug) {
        logger.logToStderr(`Executing npm: ${args.join(' ')}...`);
      }

      child_process.exec(`npm ${args.join(' ')}`, (err: child_process.ExecException | null, stdout: string): void => {
        if (err) {
          reject(err.message);
        }

        const responseString: string = stdout;
        try {
          const packageInfo: {
            dependencies?: {
              [packageName: string]: {
                version: string;
              };
            };
          } = JSON.parse(responseString);
          if (packageInfo.dependencies &&
            packageInfo.dependencies[packageName]) {
            resolve(packageInfo.dependencies[packageName].version);
          }
          else {
            reject('Package not found');
          }
        }
        catch (ex: any) {
          return reject(ex);
        }
      });
    });
  }

  private getNodeVersion(): string {
    return process.version.substr(1);
  }

  private checkStatus(what: string, versionFound: string, versionCheck: VersionCheck, optionalOrRequired: OptionalOrRequired, fixes: string[], logger: Logger): void {
    if (versionFound) {
      if (satisfies(versionFound, versionCheck.range)) {
        logger.log(this.getStatus(CheckStatus.Success, `${what} v${versionFound}`));
      }
      else {
        logger.log(this.getStatus(CheckStatus.Failure, `${what} v${versionFound} found, v${versionCheck.range} required`));
        fixes.push(versionCheck.fix);
      }
    }
  }

  private getStatus(result: CheckStatus, message: string) {
    const primarySupported: boolean = process.platform !== 'win32' ||
      process.env.CI === 'true' ||
      process.env.TERM === 'xterm-256color';
    const success: string = primarySupported ? '✔' : '√';
    const failure: string = primarySupported ? '✖' : '×';
    return `${result === CheckStatus.Success ? chalk.green(success) : chalk.red(failure)} ${message}`;
  }
}

module.exports = new SpfxDoctorCommand();
