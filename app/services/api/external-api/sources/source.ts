import {
  Source as InternalSource,
  SourcesService as InternalSourcesService,
  TSourceType,
} from 'services/sources';
import { ServiceHelper, Inject } from 'services';
import { ISerializable } from '../../rpc-api';
import { TObsFormData } from 'components/obs/inputs/ObsInput';
import { Fallback, InjectFromExternalApi } from '../../external-api';
import { SourcesService } from './sources';
import Utils from '../../../utils';

export interface ISourceModel {
  sourceId: string;
  id: string; // Streamdeck uses id field
  name: string;
  type: TSourceType;
  audio: boolean;
  video: boolean;
  async: boolean;
  muted: boolean;
  width: number;
  height: number;
  doNotDuplicate: boolean;
  channel?: number;
  resourceId: string;
  configurable: boolean;
}

@ServiceHelper()
export class Source implements ISourceModel, ISerializable {
  @Inject('SourcesService') private internalSourcesService: InternalSourcesService;
  @Fallback() private source: InternalSource;
  @InjectFromExternalApi() private sourcesService: SourcesService;
  readonly id: string;
  readonly name: string;
  readonly type: TSourceType;
  readonly audio: boolean;
  readonly video: boolean;
  readonly async: boolean;
  readonly muted: boolean;
  readonly width: number;
  readonly height: number;
  readonly doNotDuplicate: boolean;
  readonly channel?: number;
  readonly resourceId: string;
  readonly configurable: boolean;

  constructor(public readonly sourceId: string) {
    this.source = this.internalSourcesService.views.getSource(sourceId);
    Utils.applyProxy(this, () => this.getModel());
  }

  private isDestroyed(): boolean {
    return this.source.isDestroyed();
  }

  getModel(): ISourceModel {
    return this.sourcesService.convertInternalModelToExternal(this.source.getModel());
  }

  updateSettings(settings: Dictionary<any>): void {
    this.source.updateSettings(settings);
  }

  getSettings(): Dictionary<any> {
    return this.source.getSettings();
  }

  getPropertiesFormData(): TObsFormData {
    return this.source.getPropertiesFormData();
  }

  setPropertiesFormData(properties: TObsFormData): void {
    return this.source.setPropertiesFormData(properties);
  }

  hasProps(): boolean {
    return this.source.hasProps();
  }

  setName(newName: string): void {
    return this.source.setName(newName);
  }

  refresh(): void {
    this.source.refresh();
  }

  duplicate(): Source {
    return this.sourcesService.getSource(this.source.duplicate().sourceId);
  }
}
