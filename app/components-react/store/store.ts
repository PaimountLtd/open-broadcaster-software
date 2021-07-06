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
 * ReduxModuleManager controls Redux modules
 * Each Redux Module controls its own chunk of state in the global Redux store
 * Flux Modules are objects that contain initialState, actions, mutations and getters
 * They could be dynamically created and destroyed
 *
 * Use Redux Modules than you need share some logic or state between several React components,
 * Or when you have a single React component that has not-trivial logic that is better to encapsulate
 * into a different file. So you can keep this component lightweight and responsible for rendering only
 *
 * Alternative to modules could be using StatefulServices. The difference between Redux Modules and StatefulServices:
 * - StatefulServices are singleton objects. Redux Modules could have multiple instances
 * - StatefulServices always exists after initialization. Redux Modules exist only while components use them
 * - StatefulServices exist in the Worker window only and reachable from other windows by IPC only. Redux Modules exist in the same window they were created.
 *
 * Redux Modules are perfect for situations where:
 *  - You need share some logic or state between several React components
 *  - You want your complex React component be lightweight and responsible only for rendering
 *  - You have performance issues in your React component. React Modules use multiple optimisation technics
 *
 * StatefulServices and Services are perfect for situations where:
 *  - You need to have some global reactive state across multiple windows
 *  - You need a place for `http` data fetching, like API calls. So you can monitor all your http requests in the dev-tools window
 *  - You need some polling/watching code in the constantly existing object
 *  - You need to expose some API for external usage
 *  - You need generate documentation from jsdoc
 */
class ReduxModuleManager {
  public mutationState: unknown;
  private registeredModules: Record<string, IReduxMetadata> = {};

  /**
   * Register a new Redux Module and initialize it
   * @param module the module object
   * @param initParams params that will be passed in the `.init()` handler after module initialization
   */
  registerModule<TInitParams, TModule extends ReduxModule<any, any>>(
    module: TModule,
    initParams?: TInitParams,
  ): TModule {
    // use constructor name as a module name
    const moduleName = module.constructor.name;

    // collect mutations from the module prototype
    const mutations = Object.getPrototypeOf(module).mutations;

    // call `init()` method of module if exist
    module.init && module.init(initParams as TInitParams);
    const initialState = module.state;

    // Use Redux API to create Redux reducers from our mutation functions
    // this step adding the support of `Immer` library in reducers
    // https://redux-toolkit.js.org/usage/immer-reducers
    const reducer = createReducer(initialState, builder => {
      Object.keys(mutations).forEach(mutationName => {
        const action = createAction(`${moduleName}/${mutationName}`);
        builder.addCase(action, mutations[mutationName]);
      });
    });

    // Re-define the `state` variable of the module
    // It should be linked to the global Redux sate after module initialization
    // But mutation is running it should be linked to a special Proxy from the Immer library
    Object.defineProperty(module, 'state', {
      get: () => {
        if (this.mutationState) return this.mutationState;
        const globalState = store.getState() as any;
        return globalState[moduleName];
      },
    });

    // register reducer in Redux
    store.reducerManager.add(moduleName, reducer);
    // call the `initState` mutation to initialize the module's initial state
    store.dispatch({ type: 'initState', payload: { moduleName, initialState } });
    // create a record in `registeredModules` with the just created module
    this.registeredModules[moduleName] = {
      componentIds: [],
      module,
    };
    return module;
  }

  /**
   * Unregister the module and erase its state from Redux
   */
  unregisterModule(moduleName: string) {
    store.reducerManager.remove(moduleName);
    delete this.registeredModules[moduleName];
  }

  /**
   * Get the Module by name
   */
  getModule<TModule extends ReduxModule<any, any>>(moduleName: string): TModule {
    return this.registeredModules[moduleName]?.module as TModule;
  }

  /**
   * Register a component that is using the module
   */
  registerComponent(moduleName: string, componentId: string) {
    this.registeredModules[moduleName].componentIds.push(componentId);
  }

  /**
   * Un-register a component that is using the module.
   * If the module doesnt have registered components it will be destroyed
   */
  unRegisterComponent(moduleName: string, componentId: string) {
    const moduleMetadata = this.registeredModules[moduleName];
    moduleMetadata.componentIds = moduleMetadata.componentIds.filter(id => id !== componentId);
    if (!moduleMetadata.componentIds.length) this.unregisterModule(moduleName);
  }

  /**
   * When Redux is running mutation it replace the state object with a special Proxy object from
   * the Immer library. Keep this object in the `mutationState` property
   */
  setMutationState(mutationState: unknown) {
    this.mutationState = mutationState;
  }
}

let moduleManager: ReduxModuleManager;

/**
 * The ModuleManager is a singleton object accessible in other files via the `getModuleManager()` call
 */
export function getModuleManager() {
  if (!moduleManager) {
    // create the ModuleManager and
    // automatically register some additional modules
    moduleManager = new ReduxModuleManager();

    // add a module for rendering optimizations
    moduleManager.registerModule(new BatchedUpdatesModule());

    // add a module that adds Vuex support
    moduleManager.registerModule(new VuexModule());
  }
  return moduleManager;
}

/**
 * This module introduces a simple implementation of batching updates for the performance optimization
 * It prevents components to be re-rendered in the not-ready state
 * and reduces the overall amount of redundant re-renderings
 *
 * React 18 introduced automated batched updates.
 * So most likely we can remove this module after the migration to the new version
 * https://github.com/reactwg/react-18/discussions/21
 */
class BatchedUpdatesModule {
  state = {
    isRenderingDisabled: false,
  };

  /**
   * Temporary disables rendering for components when multiple mutations are applying
   */
  temporaryDisableRendering() {
    // if rendering is already disabled just ignore
    if (this.state.isRenderingDisabled) return;

    console.log('DISABLE rendering');
    // disable rendering
    this.setIsRenderingDisabled(true);

    // enable rendering again when Javascript processes the current task queue
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

/**
 * This module adds reactivity support from Vuex
 * It ensures React components should be re-rendered when Vuex mutate their dependencies
 *
 * We should remove this module after we fully migrate our components to Redux
 */
class VuexModule {
  /**
   * Keep revisions for each StatefulService module in this state
   */
  state: Record<string, number> = {};

  init() {
    // listen mutations from the global Vuex store
    // and increment the revision number for affected StatefulService
    StatefulService.store.subscribe(mutation => {
      const serviceName = mutation.type.split('.')[0];
      this.incrementRevision(serviceName);
    });
  }

  // TODO: remove
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

/**
 * A decorator that register the object method as an mutation
 */
export function mutation() {
  return function (target: any, methodName: string, descriptor: PropertyDescriptor) {
    return registerMutation(target, methodName, descriptor.value);
  };
}

/**
 * Register function as an mutation for a ReduxModule
 */
function registerMutation(target: any, mutationName: string, fn: Function) {
  // use the constructor name as a moduleName
  const moduleName = target.constructor.name;

  // create helper objects if they have not been created yet
  target.mutations = target.mutations || {};
  target.originalMethods = target.originalMethods || {};

  // save the original method
  target.originalMethods[mutationName] = fn;
  const originalMethod = fn;

  // Transform the original function into the Redux Action handler
  // So we can use this method in the Redux's `createReducer()` call
  target.mutations[mutationName] = (state: unknown, action: { payload: unknown[] }) => {
    console.log('call mutation', mutationName, action.payload);

    // Redux passing us an State and Action into arguments
    // transform the Action call to the Redux Reducer call
    const module = moduleManager.getModule(moduleName);
    moduleManager.setMutationState(state);
    originalMethod.apply(module, action.payload);
    moduleManager.setMutationState(null);
  };

  // Redirect the call of original method to the Redux`s reducer
  Object.defineProperty(target, mutationName, {
    configurable: true,
    value(...args: any[]) {
      console.log('dispatch mutation', mutationName);

      const module = moduleManager.getModule(moduleName);

      // if this method was called from another mutation
      // we don't need to dispatch a new mutation again
      // just call the original method
      const mutationIsRunning = !!moduleManager.mutationState;
      if (mutationIsRunning) return originalMethod.apply(module, args);

      const batchedUpdatesModule = moduleManager.getModule<BatchedUpdatesModule>(
        'BatchedUpdatesModule',
      );

      // dispatch reducer and call `temporaryDisableRendering()`
      // so next mutation in the javascript queue will not cause redundant re-renderings in components
      batch(() => {
        if (moduleName !== 'BatchedUpdatesModule') batchedUpdatesModule.temporaryDisableRendering();
        store.dispatch({ type: `${moduleName}/${mutationName}`, payload: args });
      });
    },
  });

  return Object.getOwnPropertyDescriptor(target, mutationName);
}

export interface ReduxModule<TInitParams, TState> {
  state: TState;
  init?: (initParams: TInitParams) => unknown;
}

interface IReduxMetadata {
  componentIds: string[];
  module: ReduxModule<any, any>;
}

type TStore = Store & {
  reducerManager: {
    add: (key: string, reducer: any) => unknown;
    remove: (key: string) => unknown;
  };
};

/**
 * This `useSelector` is a wrapper for the original `useSelector` method from Redux
 * - Optimizes component re-rendering via batched updates from Redux and Vuex
 * - Uses isDeepEqual with depth 2 as a default comparison function
 */
export function useSelector<T extends Object>(fn: () => T): T {
  const moduleManager = getModuleManager();
  const batchedUpdatesModule = moduleManager.getModule<BatchedUpdatesModule>(
    'BatchedUpdatesModule',
  );
  const cachedSelectedResult = useRef<any>(null);
  const isMountedRef = useRef(false);

  // create the selector function
  const selector = useOnCreate(() => {
    return () => {
      // if `isRenderingDisabled` selector will return previously cached values
      if (batchedUpdatesModule.state.isRenderingDisabled && isMountedRef.current) {
        return cachedSelectedResult.current;
      }

      // otherwise execute the selector
      cachedSelectedResult.current = fn();
      return cachedSelectedResult.current;
    };
  });

  useEffect(() => {
    isMountedRef.current = true;
  });

  return useReduxSelector(selector, (prevState, newState) => {
    // there is no reason to compare prevState and newState if
    // the rendering is disabled for components
    if (batchedUpdatesModule.state.isRenderingDisabled) {
      return true;
    }

    // use `isSimilar` function to compare 2 states
    if (!isSimilar(prevState, newState)) {
      return false;
    }
    return true;
  }) as T;
}

/**
 * Wraps the given object in a Proxy for watching read operations on this object
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
      _watchedObject: watchedObject,
      _dependencies: dependencies,
    },
    {
      get: (target, propName: string) => {
        // if (propName === 'hasOwnProperty') return watchedObject.hasOwnProperty;
        if (propName in target) return target[propName];
        const value = watchedObject[propName];
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
