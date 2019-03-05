import { RpcApi } from './rpc-api';
import { Inject } from 'util/injector';
import { InternalApiService } from './internal-api';
import * as apiResources from './external-api/resources';
import { Service } from 'services/service';

/**
 * A decorator to mark class as a singleton
 */
export function Singleton() {
  return function(Klass: any) {
    Klass.isSingleton = true;
  };
}

/**
 * External API for usage outside of SLOBS application
 * for stuff like remote-control, StreamDeck and other 3rd-party services
 * This API is documented and must not have breaking changes
 */
export class ExternalApiService extends RpcApi {
  /**
   * InternalApiService is for fallback calls
   */
  @Inject() private internalApiService: InternalApiService;
  /**
   * List of all API resources
   * @see RpcApi.getResource()
   */
  private resources = { ...apiResources };
  /**
   * Instances of singleton resources
   */
  private instances: Dictionary<Service> = {};

  init() {
    // initialize all singletons
    Object.keys(this.resources).forEach(resourceName => {
      const Resource = this.resources[resourceName];
      if (Resource.isSingleton) this.instances[resourceName] = new Resource();
    });
  }

  /**
   * @see RpcApi.getResource()
   * @override
   */
  getResource(resourceId: string) {
    // if resource is singleton than return the singleton instance
    if (this.instances[resourceId]) return this.instances[resourceId];

    // if resource is not singleton
    // take serialized constructor arguments from `resourceId` string and construct a new instance
    const helperName = resourceId.split('[')[0];
    const constructorArgsStr = resourceId.substr(helperName.length);
    const constructorArgs = constructorArgsStr ? JSON.parse(constructorArgsStr) : void 0;
    const Helper = this.resources[helperName];
    if (Helper) {
      return new (Helper as any)(...constructorArgs);
    }

    // this resource has been not found in the external API
    // try to fallback to InternalApiService
    return this.internalApiService.getResource(resourceId);
  }
}
