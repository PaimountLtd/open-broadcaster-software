import electron from 'electron';
import { Service } from './services/service';
import { AutoConfigService } from './services/auto-config';
import { ScenesCollectionsService, OverlaysPersistenceService } from './services/scenes-collections';
import { ObsImporterService } from './services/obs-importer';
import { YoutubeService } from './services/platforms/youtube';
import { TwitchService } from './services/platforms/twitch';
import { ScenesService, SceneItem, Scene } from './services/scenes';
import { ClipboardService } from  './services/clipboard';
import { AudioService, AudioSource } from  './services/audio';
import { CustomizationService } from  './services/customization';
import { HostsService } from  './services/hosts';
import { Hotkey, HotkeysService } from  './services/hotkeys';
import { KeyListenerService } from  './services/key-listener';
import { NavigationService } from  './services/navigation';
import { ObsApiService } from  './services/obs-api';
import { OnboardingService } from  './services/onboarding';
import { PerformanceService } from  './services/performance';
import { PersistentStatefulService } from  './services/persistent-stateful-service';
import { SettingsService } from  './services/settings';
import { SourcesService, Source } from  './services/sources';
import { UserService } from  './services/user';
import { VideoService } from  './services/video';
import { WidgetsService } from  './services/widgets';
import { WindowsService } from  './services/windows';
import { StatefulService } from './services/stateful-service';
import { ScenesTransitionsService } from  './services/scenes-transitions';
import { FontLibraryService } from './services/font-library';
import { SourceFiltersService } from  './services/source-filters';
import { AppService } from './services/app';
import { ShortcutsService } from './services/shortcuts';
import { CacheUploaderService } from './services/cache-uploader';
import { TcpServerService } from './services/tcp-server';
import { IpcServerService } from './services/ipc-server';
import { UsageStatisticsService } from './services/usage-statistics';
import { StreamInfoService } from './services/stream-info';
import { StreamingService } from  './services/streaming';
import { StreamlabelsService } from './services/streamlabels';
import Utils from './services/utils';
import { commitMutation } from './store';
import traverse from 'traverse';
import { ObserveList } from './util/service-observer';
import { Subject } from 'rxjs/Subject';
import { Subscription } from 'rxjs/Subscription';
import { Observable } from 'rxjs/Observable';

const { ipcRenderer } = electron;


/**
 * @see http://www.jsonrpc.org/specification
 */
export enum E_JSON_RPC_ERROR {
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_JSON_RPC_ERROR = -32603,
  INTERNAL_SERVER_ERROR = -32000
}

export interface IJsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params: {
    resource: string,
    args?: (string|number)[],
    fetchMutations?: boolean,
    compactMode?: boolean
  };
}

export interface IJsonRpcResponse<TResponse> {
  jsonrpc: '2.0';
  id?: string | number;
  result?: TResponse;
  error?: {
    code: number;
    message?: string
  };
  mutations?: IMutation[];
}

declare type TResourceType = 'HELPER' | 'SUBSCRIPTION' | 'EVENT';


export interface IJsonRpcEvent {
  _type: 'EVENT';
  resourceId: string;
  emitter: 'PROMISE' | 'STREAM';
  data: any;
  isRejected?: boolean;  // for PROMISE emitter only
}


export interface IMutation {
  type: string;
  payload: any;
}


export class ServicesManager extends Service {

  serviceEvent = new Subject<IJsonRpcResponse<IJsonRpcEvent>>();

  /**
   * list of used application services
   */
  private services: Dictionary<any> = {
    AutoConfigService,
    YoutubeService,
    TwitchService,
    ScenesService, SceneItem, Scene,
    ClipboardService,
    AudioService, AudioSource,
    CustomizationService,
    HostsService,
    HotkeysService, Hotkey,
    KeyListenerService,
    NavigationService,
    ObsApiService,
    OnboardingService,
    PerformanceService,
    PersistentStatefulService,
    ScenesTransitionsService,
    SettingsService,
    SourceFiltersService,
    SourcesService, Source,
    StreamingService,
    UserService,
    VideoService,
    WidgetsService,
    WindowsService,
    FontLibraryService,
    ObsImporterService,
    ScenesCollectionsService,
    OverlaysPersistenceService,
    AppService,
    ShortcutsService,
    CacheUploaderService,
    UsageStatisticsService,
    IpcServerService,
    TcpServerService,
    StreamInfoService,
    StreamlabelsService
  };

  private instances: Dictionary<Service> = {};
  private mutationsBufferingEnabled = false;
  private bufferedMutations: IMutation[] = [];

  /**
   * if result of calling a service method in the main window is promise -
   * we create a linked promise in the child window and keep it callbacks here until
   * the promise in the main window will be resolved or rejected
   */
  private promises: Dictionary<Function[]> = {};

  /**
   * keep created subscriptions to not allow to subscribe to the channel twice
   */
  subscriptions: Dictionary<Subscription> = {};

  init() {

    if (Utils.isChildWindow()) {
      Service.setupProxy(service => this.applyIpcProxy(service));
      Service.setupInitFunction(service => {
        return true;
      });
      return;
    }

    Service.serviceAfterInit.subscribe(service => this.initObservers(service));

    // this helps to debug services from console
    if (Utils.isDevMode()) {
      window['sm'] = this;
    }
  }


  private initObservers(observableService: Service): Service[] {
    const observeList: ObserveList = ObserveList.instance;
    const items = observeList.observations.filter(item => {
      return item.observableServiceName === observableService.serviceName;
    });
    return items.map(item => this.getService(item.observerServiceName).instance);
  }


  getService(serviceName: string) {
    return this.services[serviceName];
  }


  getStatefulServicesAndMutators(): Dictionary<typeof StatefulService> {
    const statefulServices = {};
    Object.keys(this.services).forEach(serviceName => {
      const ServiceClass = this.services[serviceName];
      const isStatefulService = ServiceClass['initialState'];
      const isMutator = ServiceClass.prototype.mutations;
      if (!isStatefulService && !isMutator) return;
      statefulServices[serviceName] = this.services[serviceName];
    });
    return statefulServices;
  }



  /**
   * start listen messages from main window
   */
  listenMessages() {
    const promises = this.promises;

    ipcRenderer.on('services-message', (event: Electron.Event, message: IJsonRpcResponse<IJsonRpcEvent>) => {
      // handle promise reject/resolve
      if (message.result._type !== 'EVENT' || message.result.emitter !== 'PROMISE') return;
      const promisePayload = message.result;
      if (promisePayload) {
        const [resolve, reject] = promises[promisePayload.resourceId];
        const callback = promisePayload.isRejected ? reject : resolve;
        callback(promisePayload.data);
        delete promises[promisePayload.resourceId];
      }

    });
  }


  isMutationBufferingEnabled() {
    return this.mutationsBufferingEnabled;
  }


  addMutationToBuffer(mutation: IMutation) {
    this.bufferedMutations.push(mutation);
  }


  executeServiceRequest(request: IJsonRpcRequest): IJsonRpcResponse<any> {
    let response: IJsonRpcResponse<any>;
    try {
      response = this.handleServiceRequest(request);
    } catch (e) {
      console.error(e);
      response = this.createErrorResponse({ code: E_JSON_RPC_ERROR.INTERNAL_SERVER_ERROR, id: request.id });
    } finally {
      return response;
    }
  }


  createErrorResponse(
    options: { code: E_JSON_RPC_ERROR, id?: string|number, message?: string }
  ): IJsonRpcResponse<any> {
    return {
      jsonrpc: '2.0',
      id: options.id,
      error: {
        code: options.code,
        message: E_JSON_RPC_ERROR[options.code] + (options.message ? (' ' + options.message) : ''),
      }
    };
  }


  private handleServiceRequest(request: IJsonRpcRequest): IJsonRpcResponse<any> {
    let response: IJsonRpcResponse<any>;
    const methodName = request.method;
    const {
      resource: resourceId,
      args,
      fetchMutations,
      compactMode
    } = request.params;

    if (fetchMutations) this.startBufferingMutations();

    const resource = this.getResource(resourceId);
    if (!resource) {
      response = this.createErrorResponse({
        code: E_JSON_RPC_ERROR.INVALID_PARAMS,
        id: request.id,
        message: 'resource not found'
      });
    } else if (!resource[methodName]) {
      response = this.createErrorResponse({ code: E_JSON_RPC_ERROR.METHOD_NOT_FOUND, id: request.id });
    }

    if (response) {
      if (this.isMutationBufferingEnabled()) this.stopBufferingMutations();
      return response;
    }

    let responsePayload: any;

    if (resource[methodName] instanceof Observable) {
      const subscriptionId = `${resourceId}.${methodName}`;
      responsePayload = {
        _type: 'SUBSCRIPTION',
        resourceId: subscriptionId
      };
      if (!this.subscriptions[subscriptionId]) {
        this.subscriptions[subscriptionId] = resource[methodName].subscribe((data: any) => {
          this.serviceEvent.next({
            jsonrpc: '2.0',
            result: {
              _type: 'EVENT',
              emitter: 'STREAM',
              resourceId: subscriptionId,
              data,
            } as IJsonRpcEvent
          });
        });
      }
    } else if (typeof resource[methodName] === 'function') {
      responsePayload = resource[methodName].apply(resource, args);
    } else {
      responsePayload = resource[methodName];
    }

    const isPromise = !!(responsePayload && responsePayload.then);

    if (isPromise) {
      const promiseId = ipcRenderer.sendSync('getUniqueId');
      const promise = responsePayload as PromiseLike<any>;

      promise.then(
        (data) => this.sendPromiseMessage({ isRejected: false, promiseId, data }),
        (data) => this.sendPromiseMessage({ isRejected: true, promiseId, data })
      );

      response = {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          _type: 'SUBSCRIPTION',
          resourceId: promiseId
        }
      };
    } else if (responsePayload && responsePayload.isHelper) {
      const helper = responsePayload;

      response = {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          _type: 'HELPER',
          resourceId: helper.resourceId,
          ...(!compactMode ? this.getHelperModel(helper) : {})
        }
      };
    } else {

      // payload can contain helpers-objects
      // we have to wrap them in IpcProxy too
      traverse(responsePayload).forEach((item: any) => {
        if (item && item.isHelper) {
          const helper = this.getHelper(item.helperName, item.constructorArgs);
          return {
            _type: 'HELPER',
            resourceId: helper.resourceId,
            ...(!compactMode ? this.getHelperModel(helper) : {})
          };
        }
      });

      response = {
        jsonrpc: '2.0',
        id: request.id,
        result: responsePayload
      };
    }

    if (fetchMutations) response.mutations = this.stopBufferingMutations();

    return response;
  }

  /**
   * returns Service instance or ServiceHelper instance
   * @example
   * sourcesService = getResource('SourcesService')
   *
   * @example
   * source = getResource('Source[12]')
   */
  private getResource(resourceId: string) {

    if (this.services[resourceId]) {
      return this.getInstance(resourceId) || this.initService(resourceId);
    }

    const helperName = resourceId.split('[')[0];
    const constructorArgsStr = resourceId.substr(helperName.length);
    const constructorArgs = constructorArgsStr ? JSON.parse(constructorArgsStr) : void 0;
    return this.getHelper(helperName, constructorArgs);
  }


  private getHelperModel(helper: Object): Object {
    if (helper['getModel']) return helper['getModel']();
    return {};
  }


  /**
   * start buffering mutations to send them
   * as result of a service's method call
   */
  private startBufferingMutations() {
    this.mutationsBufferingEnabled = true;
  }


  /**
   * stop buffering and clear buffer
   */
  private stopBufferingMutations(): IMutation[] {
    this.mutationsBufferingEnabled = false;
    const mutations = this.bufferedMutations;
    this.bufferedMutations = [];
    return mutations;
  }


  /**
   * uses for child window services
   * all services methods calls will be sent to the main window
   */
  private applyIpcProxy(service: Service): Service {

    const availableServices = Object.keys(this.services);
    if (!availableServices.includes(service.constructor.name)) return service;

    return new Proxy(service, {
      get: (target, property, receiver) => {

        if (!target[property]) return target[property];

        if (target[property].isHelper) {
          return this.applyIpcProxy(target[property]);
        }

        if (typeof target[property] !== 'function') return target[property];

        const serviceName = target.constructor.name;
        const methodName = property;
        const isHelper = target['isHelper'];

        return (...args: any[]) => {

          const response: IJsonRpcResponse<any> = electron.ipcRenderer.sendSync('services-request', {
            id: ipcRenderer.sendSync('getUniqueId'),
            method: methodName,
            params: {
              resource: isHelper ? target['resourceId'] : serviceName,
              args,
              compactMode: true,
              fetchMutations: true
            }
          } as IJsonRpcRequest);

          if (response.error) {
            throw 'IPC request failed: check the errors in the main window';
          }

          const result = response.result;
          response.mutations.forEach(mutation => commitMutation(mutation));

          if (result && result._type === 'SUBSCRIPTION') {
            return new Promise((resolve, reject) => {
              const promiseId = result.resourceId;
              this.promises[promiseId] = [resolve, reject];
            });
          } else if (result && result._type === 'HELPER') {
            const helper = this.getResource(result.resourceId);
            return this.applyIpcProxy(helper);
          } else {
            // payload can contain helpers-objects
            // we have to wrap them in IpcProxy too
            traverse(result).forEach((item: any) => {
              if (item && item._type === 'HELPER') {
                const helper = this.getResource(item.resourceId);
                return this.applyIpcProxy(helper);
              }
            });
            return result;
          }

        };
      }
    });
  }


  private getHelper(name: string, constructorArgs: any[]) {
    const Helper = this.services[name];
    if (!Helper) return null;
    return new (Helper as any)(...constructorArgs);
  }


  private initService(serviceName: string): Service {
    const ServiceClass = this.services[serviceName];
    if (!ServiceClass) throw `unknown service: ${serviceName}`;
    if (this.instances[serviceName]) return;
    this.instances[serviceName] = ServiceClass.instance;
    return ServiceClass.instance;
  }


  private getInstance(serviceName: string): Service {
    return this.instances[serviceName];
  }



  private sendPromiseMessage(info: { isRejected: boolean, promiseId: string, data: any }) {
    this.serviceEvent.next({
      jsonrpc: '2.0',
      result: {
        _type: 'EVENT',
        emitter: 'PROMISE',
        data: info.data,
        resourceId: info.promiseId,
        isRejected: info.isRejected
      } as IJsonRpcEvent
    });
  }
}
