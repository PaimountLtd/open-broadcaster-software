import { cloneDeep } from 'lodash';
import { HostsService } from 'services/hosts';
import { Inject } from '../../../util/injector';
import { UserService } from 'services/user';
import {
  handleErrors,
  authorizedHeaders
} from '../../../util/requests';
import {
  IWidgetApiSettings, IWidgetData, IWidgetSettings,
  IWidgetSettingsGenericState, IWidgetSettingsServiceApi,
  IWidgetSettingsState, TWIdgetLoadingState,
  WidgetsService
} from 'services/widgets';
import { Subject } from 'rxjs/Subject';
import { IInputMetadata } from 'components/shared/inputs/index';
import { mutation, StatefulService } from 'services/stateful-service';
import { WebsocketService } from 'services/websocket';

export const WIDGET_INITIAL_STATE: IWidgetSettingsGenericState = {
  loadingState: 'none',
  data: null,
  rawData: null
};

export type THttpMethod = 'GET' | 'POST' | 'DELETE';

interface ISocketEvent{
  type: string;
  message: Dictionary<any>;
}

/**
 * base class for widget settings
 */
export abstract class WidgetSettingsService<TWidgetData extends IWidgetData>
  extends StatefulService<IWidgetSettingsState<TWidgetData>>
  implements IWidgetSettingsServiceApi
{

  @Inject() private hostsService: HostsService;
  @Inject() private userService: UserService;
  @Inject() private widgetsService: WidgetsService;
  @Inject() protected websocketService: WebsocketService;

  dataUpdated = new Subject<TWidgetData>();

  abstract getApiSettings(): IWidgetApiSettings;


  init() {
    this.websocketService.socketEvent.subscribe(event  => {
      const apiSettings = this.getApiSettings();
      if (event.type !== apiSettings.settingsUpdateEvent) return;
      this.onSettingsUpdatedHandler(event as ISocketEvent)
    });
  }

  private onSettingsUpdatedHandler(event: ISocketEvent) {
    if (!this.state.data) return;
    const rawData = cloneDeep(this.state.rawData);
    rawData.settings = event.message;
    const data = this.handleDataAfterFetch(rawData);
    this.SET_WIDGET_DATA(data, rawData);
    this.dataUpdated.next(this.state.data);
  }

  async fetchData(): Promise<TWidgetData> {
    if (!this.state.data) await this.loadData();
    return this.state.data;
  }

  protected async loadData() {
    // load widget settings data into state
    const isFirstLoading = !this.state.data;
    if (isFirstLoading) this.SET_LOADING_STATE('pending');
    const apiSettings = this.getApiSettings();
    let rawData: any;
    try {
      rawData = await this.request({
        url: apiSettings.dataFetchUrl,
        method: 'GET'
      });
    } catch (e) {
      if (isFirstLoading) this.SET_LOADING_STATE('fail');
      throw e;
    }
    this.SET_LOADING_STATE('success');
    const data: TWidgetData = this.handleDataAfterFetch(rawData);
    this.SET_WIDGET_DATA(data, rawData);
    this.dataUpdated.next(this.state.data);
  }

  protected async refreshData() {
    await this.loadData();
    this.dataUpdated.next(this.state.data);
  }

  protected handleDataAfterFetch(rawData: any): TWidgetData {
    const data = cloneDeep(rawData);

    // patch fetched data to have the same data format
    if (data.custom) data.custom_defaults = data.custom;

    data.type = this.getApiSettings().type;

    // widget-specific patching
    return this.patchAfterFetch(data);
  }

  /**
   * override this method to patch data after fetching
   */
  protected patchAfterFetch(data: any): any {
    return data;
  }

  /**
   * override this method to patch data before save
   */
  protected patchBeforeSend(settings: IWidgetSettings): any {
    return settings;
  }

  getMetadata(): Dictionary<IInputMetadata>  {
    return {};
  }

  async saveSettings(settings: IWidgetSettings) {
    const body = this.patchBeforeSend(settings);
    const apiSettings = this.getApiSettings();
    return await this.request({
      url: apiSettings.settingsSaveUrl,
      method: 'POST',
      body
    });
  }


  async request(req: { url: string, method?: THttpMethod, body?: any }): Promise<any> {
    const method = req.method || 'GET';
    const headers = authorizedHeaders(this.getApiToken());
    headers.append('Content-Type', 'application/json');

    const request = new Request(req.url, {
      headers,
      method,
      body: req.body ? JSON.stringify(req.body) : void 0
    });

    return fetch(request)
      .then(handleErrors)
      .then(response => response.json());
  }

  protected getHost(): string {
    return this.hostsService.streamlabs;
  }

  protected getWidgetToken(): string {
    return this.userService.widgetToken;
  }

  protected getApiToken(): string {
    return this.userService.apiToken;
  }

  @mutation()
  protected SET_LOADING_STATE(loadingState: TWIdgetLoadingState) {
    this.state.loadingState = loadingState;
  }

  @mutation()
  protected SET_WIDGET_DATA(data: TWidgetData, rawData: any) {
    this.state.data = data;
    this.state.rawData = rawData;
  }
}
