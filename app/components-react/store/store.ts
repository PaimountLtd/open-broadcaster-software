import { combineReducers, createAction, createReducer, createStore, Store } from '@reduxjs/toolkit';
import { batch, shallowEqual, useSelector as useReduxSelector } from 'react-redux';
import { StatefulService } from '../../services';
import isPlainObject from 'lodash/isPlainObject';
import { useOnCreate } from '../hooks';
import { useEffect, useRef } from 'react';

/**
 * Creates reducer manager that allows using dynamic reducers
 * Code example from https://redux.js.org/recipes/code-splitting#using-a-reducer-manager
 */
function createReducerManager() {
  // Create an object which maps keys to reducers
  const reducers = {
    global: createReducer({}, {}),
  };

  // Create the initial combinedReducer
  // let combinedReducer = combineReducers(reducers);
  let combinedReducer = combineReducers(reducers);

  // An array which is used to delete state keys when reducers are removed
  let keysToRemove: string[] = [];

  return {
    getReducerMap: () => reducers,

    // The root reducer function exposed by this object
    // This will be passed to the store
    reduce: (state: any, action: any) => {
      // If any reducers have been removed, clean up their state first
      if (keysToRemove.length > 0) {
        state = { ...state };
        for (const key of keysToRemove) {
          delete state[key];
        }
        keysToRemove = [];
      }

      // Delegate to the combined reducer
      return combinedReducer(state, action);
    },

    // Adds a new reducer with the specified key
    add: (key: string, reducer: any) => {
      if (!key || reducers[key]) {
        return;
      }

      // Add the reducer to the reducer mapping
      reducers[key] = reducer;

      // Generate a new combined reducer
      combinedReducer = combineReducers(reducers);
    },

    // Removes a reducer with the specified key
    remove: (key: string) => {
      if (!key || !reducers[key]) {
        return;
      }

      // Remove it from the reducer mapping
      delete reducers[key];

      // Add the key to the list of keys to clean up
      keysToRemove.push(key);

      // Generate a new combined reducer
      combinedReducer = combineReducers(reducers);
    },
  };
}

function configureStore() {
  const reducerManager = createReducerManager();

  // Create a store with the root reducer function being the one exposed by the manager.
  const store = createStore(reducerManager.reduce, {}) as TStore;

  // Optional: Put the reducer manager on the store so it is easily accessible
  store.reducerManager = reducerManager;
  return store;
}

export const store = configureStore();

/**
 * ModuleManager allows to access parts of store via StateController
 * StateController are objects that contain initialState, actions, mutations and getters
 */
class ModuleManager {
  public mutationState: unknown;
  private registeredModules: Record<string, IModuleMetadata> = {};

  registerModule<TInitParams, TModule extends IStatefulModule<any>>(
    module: TModule,
    initParams?: TInitParams,
  ): TModule {
    const moduleName = module.constructor.name;
    const mutations = Object.getPrototypeOf(module).mutations;
    module.init && module.init(initParams as TInitParams);
    const initialState = module.state;

    const reducer = createReducer(initialState, builder => {
      Object.keys(mutations).forEach(mutationName => {
        const action = createAction(`${moduleName}/${mutationName}`);
        builder.addCase(action, mutations[mutationName]);
      });
    });

    Object.defineProperty(module, 'state', {
      get: () => {
        if (this.mutationState) return this.mutationState;
        const globalState = store.getState() as any;
        return globalState[moduleName];
      },
    });

    store.reducerManager.add(moduleName, reducer);
    store.dispatch({ type: 'initState', payload: { moduleName, initialState } });
    this.registeredModules[moduleName] = {
      componentIds: [],
      module,
    };
    return module;
  }

  unregisterModule(moduleName: string) {
    store.reducerManager.remove(moduleName);
    delete this.registeredModules[moduleName];
  }

  getModule<TModule extends IStatefulModule<any>>(moduleName: string): TModule {
    return this.registeredModules[moduleName]?.module as TModule;
  }

  registerComponent(moduleName: string, componentId: string) {
    this.registeredModules[moduleName].componentIds.push(componentId);
  }

  unRegisterComponent(moduleName: string, componentId: string) {
    const moduleMetadata = this.registeredModules[moduleName];
    moduleMetadata.componentIds = moduleMetadata.componentIds.filter(id => id !== componentId);
    if (!moduleMetadata.componentIds.length) this.unregisterModule(moduleName);
  }

  setMutationState(mutationState: unknown) {
    this.mutationState = mutationState;
  }
}

class BatchedUpdatesModule {
  state = {
    isRenderingDisabled: false,
  };

  temporaryDisableRendering() {
    if (this.state.isRenderingDisabled) return;

    console.log('DISABLE rendering');
    this.setIsRenderingDisabled(true);

    setTimeout(() => {
      console.log('ENABLE rendering');
      this.setIsRenderingDisabled(false);
    });
  }

  @mutation()
  private setIsRenderingDisabled(disabled: boolean) {
    this.state.isRenderingDisabled = disabled;
  }
}

let moduleManager: ModuleManager;
export function getModuleManager() {
  if (!moduleManager) {
    moduleManager = new ModuleManager();
    moduleManager.registerModule(new BatchedUpdatesModule());
    moduleManager.registerModule(new VuexModule());
  }
  return moduleManager;
}

/**
 * A decorator that register the object method as an mutation
 */
export function mutation() {
  return function (target: any, methodName: string, descriptor: PropertyDescriptor) {
    return registerMutation(target, methodName, descriptor.value);
  };
}

/**
 * Register function as an mutation
 */
function registerMutation(target: any, mutationName: string, fn: Function) {
  const moduleName = target.constructor.name;

  target.mutations = target.mutations || {};
  target.originalMethods = target.originalMethods || {};
  target.originalMethods[mutationName] = fn;
  const originalMethod = fn;

  target.mutations[mutationName] = (state: unknown, action: { payload: unknown[] }) => {
    console.log('call mutation', mutationName, action.payload);

    const module = moduleManager.getModule(moduleName);
    moduleManager.setMutationState(state);
    originalMethod.apply(module, action.payload);
    moduleManager.setMutationState(null);
  };

  Object.defineProperty(target, mutationName, {
    configurable: true,
    value(...args: any[]) {
      console.log('dispatch action', mutationName);

      const module = moduleManager.getModule(moduleName);
      const mutationIsRunning = !!moduleManager.mutationState;
      if (mutationIsRunning) return originalMethod.apply(module, args);

      const batchedUpdatesModule = moduleManager.getModule<BatchedUpdatesModule>(
        'BatchedUpdatesModule',
      );

      batch(() => {
        if (moduleName !== 'BatchedUpdatesModule') batchedUpdatesModule.temporaryDisableRendering();
        store.dispatch({ type: `${moduleName}/${mutationName}`, payload: args });
      });
    },
  });

  return Object.getOwnPropertyDescriptor(target, mutationName);
}

export interface IStatefulModule<TInitParams> {
  state: any;
  init?: (initParams: TInitParams) => unknown;
}

interface IModuleMetadata {
  componentIds: string[];
  module: IStatefulModule<any>;
}

type TStore = Store & {
  reducerManager: {
    add: (key: string, reducer: any) => unknown;
    remove: (key: string) => unknown;
  };
};

class VuexModule {
  state: Record<string, number> = {};

  init() {
    StatefulService.store.subscribe(mutation => {
      const serviceName = mutation.type.split('.')[0];
      this.incrementRevision(serviceName);
    });
  }

  watchReadOperations(fn: Function) {
    return StatefulService.watchReadOperations(fn);
  }

  @mutation()
  incrementRevision(statefulServiceName: string) {
    if (!this.state[statefulServiceName]) {
      this.state[statefulServiceName] = 1;
    } else {
      this.state[statefulServiceName]++;
    }
  }
}

export function useSelector<T extends Object>(fn: () => T): T {
  const moduleManager = getModuleManager();
  const batchedUpdatesModule = moduleManager.getModule<BatchedUpdatesModule>(
    'BatchedUpdatesModule',
  );
  const cachedSelectedResult = useRef<any>(null);
  const isMountedRef = useRef(false);

  const selector = useOnCreate(() => {
    return () => {
      if (batchedUpdatesModule.state.isRenderingDisabled && isMountedRef.current) {
        return cachedSelectedResult.current;
      }

      cachedSelectedResult.current = fn();
      return cachedSelectedResult.current;
    };
  });

  useEffect(() => {
    isMountedRef.current = true;
  });

  return useReduxSelector(selector, (prevState, newState) => {
    if (batchedUpdatesModule.state.isRenderingDisabled) {
      return true;
    }

    if (!isSimilar(prevState, newState)) {
      return false;
    }
    return true;
  }) as T;
}


/**
 * Tracks read operations on the object
 *
 * @example
 *
 * const myObject = { foo: 1, bar: 2, qux: 3};
 * const { watcherProxy, getDependentFields } = createDependencyWatcher(myObject);
 * const { foo, bar } = watcherProxy;
 * getDependentFields(); // returns ['foo', 'bar'];
 *
 */
export function createDependencyWatcher<T extends object>(watchedObject: T) {
  const dependencies: Record<string, any> = {};
  const watcherProxy = new Proxy(
    {
      _proxyName: 'DependencyWatcher',
      // useBinding,
    },
    {
      get: (target, propName: string) => {
        // if (propName === 'hasOwnProperty') return watchedObject.hasOwnProperty;
        if (propName in target) return target[propName];
        const value = watchedObject[propName];

        // // Input bindings that have been created via createBinding() are source of
        // // component's dependencies. We should handle them differently
        // if (value && value._proxyName === 'Binding') {
        //   // if we already have the binding in the deps, just return it
        //   if (propName in dependencies) {
        //     return dependencies[propName];
        //   } else {
        //     // if it's the first time we access binding then clone it to dependencies
        //     // the binding object keep its own dependencies and cloning will reset them
        //     // that ensures each component will have it's own dependency list for the each binding
        //     dependencies[propName] = value._binding.clone();
        //     return dependencies[propName];
        //   }
        // } else {
        // for non-binding objects just save their value in the dependencies
        dependencies[propName] = value;
        return value;
        // }
      },
    },
  ) as T;

  function getDependentFields() {
    return Object.keys(dependencies);
  }

  function getDependentValues(): Partial<T> {
    const values: Partial<T> = {};
    Object.keys(dependencies).forEach(propName => {
      const value = dependencies[propName];
      // if one of dependencies is a binding then expose its internal dependencies
      if (value && value._proxyName === 'Binding') {
        const bindingMetadata = value._binding;
        Object.keys(bindingMetadata.dependencies).forEach(bindingPropName => {
          values[`${bindingPropName}__binding-${bindingMetadata.id}`] =
            dependencies[propName][bindingPropName].value;
        });
        return;
      }
      // if it's not a binding then just take the value from the watchedObject
      values[propName] = watchedObject[propName];
    });
    return values;
  }

  // /**
  //  * Hook for creating an reactive input binding
  //  */
  // function useBinding<TState extends object>(
  //   stateGetter: (view: T) => TState,
  //   stateSetter: (patch: TState) => unknown,
  // ): TBindings<TState, keyof TState> {
  //   const bindingRef = useRef<TBindings<TState, keyof TState>>();
  //   if (!bindingRef.current) {
  //     const binding = createBinding(() => stateGetter(watchedObject), stateSetter);
  //     dependencies[binding._binding.id] = binding;
  //     bindingRef.current = binding;
  //   }
  //   assertIsDefined(bindingRef.current);
  //   return bindingRef.current;
  // }

  return { watcherProxy, getDependentFields, getDependentValues };
}


/**
 * consider isSimilar as isDeepEqual with depth 2
 */
function isSimilar(obj1: any, obj2: any) {
  return isDeepEqual(obj1, obj2, 0, 2);
}

/**
 * Compare 2 object with limited depth
 */
function isDeepEqual(obj1: any, obj2: any, currentDepth: number, maxDepth: number): boolean {
  if (obj1 === obj2) return true;
  if (currentDepth === maxDepth) return false;
  if (Array.isArray(obj1) && Array.isArray(obj2)) return isArrayEqual(obj1, obj2);
  if (isPlainObject(obj1) && isPlainObject(obj2)) {
    const [keys1, keys2] = [Object.keys(obj1), Object.keys(obj2)];
    if (keys1.length !== keys2.length) return false;
    for (const key of keys1) {
      if (!isDeepEqual(obj1[key], obj2[key], currentDepth + 1, maxDepth)) return false;
    }
    return true;
  }
  return false;
}

/**
 * Shallow compare 2 arrays
 */
function isArrayEqual(a: any[], b: any[]) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
