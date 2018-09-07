import { Module, EApiPermissions, apiMethod, apiEvent, NotImplementedError } from './module';
import { SourcesService, TSourceType, Source } from 'services/sources';
import { Inject } from 'util/injector';
import { Subject } from 'rxjs/Subject';

interface ISourceFlags {
  audio: boolean;
  video: boolean;
  async: boolean;
}

interface ISourceSize {
  width: number;
  height: number;
}

interface ISource {
  id: string;
  name: string;
  type: TSourceType;
  flags: ISourceFlags;
  size: ISourceSize;
  appId?: string;
}

export class SourcesModule extends Module {

  moduleName = 'Sources';
  permissions = [EApiPermissions.ScenesSources]

  @Inject() private sourcesService: SourcesService;

  constructor() {
    super();
    this.sourcesService.sourceAdded.subscribe(sourceData => {
      const source = this.sourcesService.getSourceById(sourceData.sourceId);
      this.sourceAdded.next(this.serializeSource(source));
    });
    this.sourcesService.sourceUpdated.subscribe(sourceData => {
      const source = this.sourcesService.getSourceById(sourceData.sourceId);
      this.sourceUpdated.next(this.serializeSource(source));
    })
    this.sourcesService.sourceRemoved.subscribe(sourceData => {
      this.sourceRemoved.next(sourceData.sourceId);
    });
  }

  @apiEvent()
  sourceAdded = new Subject<ISource>();

  @apiEvent()
  sourceUpdated = new Subject<ISource>();

  @apiEvent()
  sourceRemoved = new Subject<string>();

  @apiMethod()
  getSources() {
    return this.sourcesService.getSources().map(source => this.serializeSource(source));
  }

  @apiMethod()
  createSource() {
    throw new NotImplementedError();
  }

  @apiMethod()
  updateSource(patch: Partial<ISource>) {
    const requiredKeys = ['id'];
    this.validatePatch(requiredKeys, patch);

    const source = this.sourcesService.getSource(patch.id);

    if (patch.name) source.setName(patch.name);
  }

  @apiMethod()
  removeSource() {
    throw new NotImplementedError();
  }

  @apiMethod()
  getObsSettings(sourceId: string) {
    return this.sourcesService.getSource(sourceId).getSettings();
  }

  @apiMethod()
  setObsSettings(sourceId: string, settingsPatch: Dictionary<any>) {
    return this.sourcesService.getSource(sourceId).updateSettings(settingsPatch);
  }

  private serializeSource(source: Source): ISource {
    const serialized: ISource = {
      id: source.sourceId,
      name: source.name,
      type: source.type,
      flags: {
        audio: source.audio,
        video: source.video,
        async: source.async
      },
      size: {
        width: source.width,
        height: source.height
      }
    };

    if (source.getPropertiesManagerType() === 'platformApp') {
      serialized.appId = source.getPropertiesManagerSettings().appId;
    }

    return serialized;
  }

}

