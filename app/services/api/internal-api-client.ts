import electron from 'electron';
import { Observable, Subject } from 'rxjs';
import { IJsonRpcEvent, IJsonRpcResponse, IMutation, JsonrpcService } from 'services/api/jsonrpc';
import * as traverse from 'traverse';
import { Service } from '../core/service';
import { ServicesManager } from '../../services-manager';
import { commitMutation } from '../../store';
import { ServiceHelper } from 'services/core';
import Utils from 'services/utils';
const { ipcRenderer } = electron;

/**
 * A client for communication with internalApi
 * Only the child window and one-off windows instantiate this class
 */
export class InternalApiClient {
  private servicesManager: ServicesManager = ServicesManager.instance;

  /**
   * If the result of calling a service method in the main window is promise -
   * we create a linked promise in the child window and keep its callbacks here until
   * the promise in the main window will be resolved or rejected
   */
  private promises: Dictionary<Function[]> = {};

  /**
   * Similar to promises, but holds promises specifically waiting for
   * async action responses.
   */
  private actionResponses: Dictionary<Function[]> = {};

  /**
   * almost the same as `promises` but for keeping subscriptions
   */
  private subscriptions: Dictionary<Subject<any>> = {};

  private skippedMutations: number[] = [];

  constructor() {
    this.listenWorkerWindowMessages();
  }

  /**
   * All services methods calls will be sent to the main window
   * TODO: add more comments and try to refactor
   */
  applyIpcProxy(service: Service, isAction = false, shouldReturn = false): Service {
    const availableServices = Object.keys(this.servicesManager.services);
    if (!availableServices.includes(service.constructor.name)) return service;

    return new Proxy(service, {
      get: (target, property, receiver) => {
        if (property === 'actions') {
          return this.applyIpcProxy(target, true);
        }

        if (isAction && property === 'return') {
          return this.applyIpcProxy(target, true, true);
        }

        if (!target[property]) return target[property];

        if (Reflect.getMetadata('executeInCurrentWindow', target, property as string)) {
          return target[property];
        }

        if (typeof target[property] !== 'function' && !(target[property] instanceof Observable)) {
          return target[property];
        }

        const methodName = property.toString();
        const isHelper = target['_isHelper'];

        // TODO: Remove once you're sure this is impossible
        if (isHelper) {
          throw new Error('ATTEMPTED TO PROXY HELPER METHOD');
        }

        const handler = this.getRequestHandler(target, methodName, {
          isAction,
          shouldReturn,
        });

        if (typeof target[property] === 'function') return handler;
        if (target[property] instanceof Observable) return handler();
      },
    });
  }

  getRequestHandler(
    target: any,
    methodName: string,
    options: { isAction: boolean; shouldReturn: boolean },
  ) {
    const serviceName = target.constructor.name;
    const isHelper = target['_isHelper'];

    return (...args: any[]) => {
      // args may contain ServiceHelper objects
      // serialize them
      traverse(args).forEach((item: any) => {
        if (item && item._isHelper) {
          return {
            _type: 'HELPER',
            resourceId: item._resourceId,
          };
        }
      });

      if (options.isAction) {
        const request = this.jsonrpc.createRequestWithOptions(
          isHelper ? target['_resourceId'] : serviceName,
          methodName as string,
          { compactMode: true, fetchMutations: false, noReturn: !options.shouldReturn },
          ...args,
        );

        ipcRenderer.send('services-request-async', request);

        if (options.shouldReturn) {
          // Return a promise that will be fulfilled later with the response
          return new Promise((resolve, reject) => {
            this.actionResponses[request.id] = [resolve, reject];
          });
        }

        // We don't care about the response
        return;
      }

      if (Utils.isDevMode()) {
        console.warn(
          `Calling synchronous service method from renderer process: ${
            isHelper ? target['_resourceId'] : serviceName
          }.${methodName} - Consider calling as an action instead`,
        );
      }

      const response: IJsonRpcResponse<any> = electron.ipcRenderer.sendSync(
        'services-request',
        this.jsonrpc.createRequestWithOptions(
          isHelper ? target['_resourceId'] : serviceName,
          methodName,
          { compactMode: true, fetchMutations: true },
          ...args,
        ),
      );

      if (response.error) {
        throw new Error('IPC request failed: check the errors in the worker window');
      }

      const result = response.result;
      const mutations = response.mutations;

      // commit all mutations caused by the api-request now
      mutations.forEach(mutation => commitMutation(mutation));
      // we'll still receive already committed mutations from async IPC event
      // mark them as ignored
      this.skippedMutations.push(...mutations.map(m => m.id));

      return this.handleResult(result);
    };
  }

  /**
   * Handles a services response result and processes special cases
   * such as promises, event subscriptions, helpers, and services.
   * @param result The processed result
   */
  handleResult(result: any) {
    if (result && result._type === 'SUBSCRIPTION') {
      if (result.emitter === 'PROMISE') {
        return new Promise((resolve, reject) => {
          const promiseId = result.resourceId;
          this.promises[promiseId] = [resolve, reject];
        });
      }

      if (result.emitter === 'STREAM') {
        return (this.subscriptions[result.resourceId] =
          this.subscriptions[result.resourceId] || new Subject());
      }
    }

    if (result && (result._type === 'HELPER' || result._type === 'SERVICE')) {
      const helper = this.getResource(result.resourceId);
      return helper;
    }

    // payload can contain helpers-objects
    // we have to wrap them in IpcProxy too
    traverse(result).forEach((item: any) => {
      if (item && item._type === 'HELPER') {
        return this.getResource(item.resourceId);
      }
    });

    return result;
  }

  getResource(resourceId: string) {
    // ServiceManager already applied the proxy-function to all services in the ChildWindow
    return this.servicesManager.getResource(resourceId);
  }

  handleMutation(mutation: IMutation) {
    const ind = this.skippedMutations.indexOf(mutation.id);
    if (ind !== -1) {
      // this mutation is already committed
      this.skippedMutations.splice(ind, 1);
      return;
    }
    commitMutation(mutation);
  }

  /**
   * just a shortcut for static functions in JsonrpcService
   */
  get jsonrpc() {
    return JsonrpcService;
  }

  /**
   *  The worker window sends results of promises resolve/reject and
   *  RXJS events as JSON messages via IPC to the renderer windows
   *  Listen and handle these messages here
   */
  private listenWorkerWindowMessages() {
    const promises = this.promises;

    ipcRenderer.on('services-response-async', (e, response: IJsonRpcResponse<any>) => {
      if (response.error) {
        this.actionResponses[response.id][1](response.error);
        return;
      }

      const result = this.handleResult(response.result);

      if (result instanceof Promise) {
        // Roll this promise into the original response promise
        result
          .then(r => this.actionResponses[response.id][0](r))
          .catch(r => this.actionResponses[response.id][1](r));
      } else {
        this.actionResponses[response.id][0](result);
      }
    });

    ipcRenderer.on(
      'services-message',
      (event: Electron.Event, message: IJsonRpcResponse<IJsonRpcEvent>) => {
        // handle only `EVENT` messages here
        if (message.result._type !== 'EVENT') return;

        // handle promise reject/resolve
        if (message.result.emitter === 'PROMISE') {
          const promisePayload = message.result;
          if (promisePayload) {
            // skip the promise result if this promise has been created from another window
            if (!promises[promisePayload.resourceId]) return;

            // resolve or reject the promise depending on the response from the main window
            const [resolve, reject] = promises[promisePayload.resourceId];
            const callback = promisePayload.isRejected ? reject : resolve;
            callback(promisePayload.data);
            delete promises[promisePayload.resourceId];
          }
        } else if (message.result.emitter === 'STREAM') {
          // handle RXJS events
          const resourceId = message.result.resourceId;
          if (!this.subscriptions[resourceId]) return;
          this.subscriptions[resourceId].next(message.result.data);
        }
      },
    );
  }
}
