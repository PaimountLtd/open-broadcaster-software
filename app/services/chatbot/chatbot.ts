import Vue from 'vue';
import { PersistentStatefulService } from '../persistent-stateful-service';
import { UserService } from 'services/user';
import { Inject } from 'util/injector';
import { handleErrors, authorizedHeaders } from 'util/requests';
import { mutation } from '../stateful-service';
import { WindowsService } from 'services/windows';

import {
  IChatbotApiServiceState,
  IChatbotAuthResponse,
  ICustomCommand,
  IDefaultCommand,
  ITimer,
  IDafaultCommandsResponse,
  ICustomCommandsResponse,
  ITimersResponse,
  IChatbotAPIPostResponse,
  IChatbotAPIPutResponse,
  ICommandVariablesResponse,
  IChatAlertsResponse
} from './chatbot-interfaces';

export class ChatbotApiService extends PersistentStatefulService<IChatbotApiServiceState> {
  @Inject() userService: UserService;
  @Inject() chatbotCommonService: ChatbotCommonService;

  apiUrl = 'https://chatbot-api.streamlabs.com/';
  version = 'api/v1/';

  static defaultState: IChatbotApiServiceState = {
    apiToken: null,
    socketToken: null,
    defaultCommandsResponse: {
      commands: {},
      'link-protection': {},
      giveaway: {}
    },
    customCommandsResponse: {
      pagination: {
        current: 1,
        total: 1
      },
      data: []
    },
    commandVariablesResponse: [],
    timersResponse: {
      pagination: {
        current: 1,
        total: 1
      },
      data: []
    },
    chatAlertsResponse: {
      enabled: false,
      settings: null
    }
  };

  //
  // service methods
  //

  logIn() {
    return new Promise((resolve, reject) => {
      const url = this.apiEndpoint('login');
      const headers = authorizedHeaders(this.userService.apiToken);
      headers.append('Content-Type', 'application/json');
      const request = new Request(url, {
        headers,
        method: 'POST',
        body: JSON.stringify({})
      });

      fetch(request)
        .then(handleErrors)
        .then(response => response.json())
        .then((response: IChatbotAuthResponse) => {
          this.LOGIN(response);
          resolve(true);
        })
        .catch(err => {
          reject(err);
        });
    });
  }

  apiEndpoint(route: String, versionIncluded?: Boolean) {
    return `${this.apiUrl}${versionIncluded ? this.version : ''}${route}`;
  }


  api(method: string, endpoint: string, data: any) {
    const url = this.apiEndpoint(endpoint, true);
    const headers = authorizedHeaders(this.state.apiToken);
    let options: {
      headers: any,
      method: string,
      body?: string
    } = {
      headers,
      method,
    };
    if (method.toLowerCase() === 'post' || method.toLowerCase() === 'put') {
      options.headers.append('Content-Type', 'application/json');
      options.body = JSON.stringify(data || {});
    }
    const request = new Request(url, options);

    return fetch(request)
      .then(handleErrors)
      .then(response => response.json());
  }

  //
  // GET requests
  //

  fetchDefaultCommands() {
    return this.api('GET', 'commands/default', {})
      .then((response: IDafaultCommandsResponse) => {
        this.UPDATE_DEFAULT_COMMANDS(response);
      });
  }

  fetchCustomCommands(page?: number) {
    return this.api('GET', `commands?page=${page || 1}`, {})
      .then((response: ICustomCommandsResponse) => {
        this.UPDATE_CUSTOM_COMMANDS(response);
      });
  }

  fetchCommandVariables() {
    // fetch command variables
    // and then UPDATE_COMMAND_VARIABLES(response);
    // assuming response is [{}]
  }

  fetchTimers(page?: number) {
    return this.api('GET', `timers?page=${page || 1}`, {})
      .then((response: ITimersResponse) => {
        this.UPDATE_TIMERS(response);
      });
  }

  fetchChatAlerts() {
    return this.api('GET', 'settings/chat-notifications', {})
      .then((response: IChatAlertsResponse) => {
        debugger;
        this.UPDATE_CHAT_ALERTS(response);
      })
  }

  //
  // POST, PUT requests
  //
  createCustomCommand(data: ICustomCommand) {
    return this.api('POST', 'commands', data)
      .then((response: ICustomCommand) => {
        this.fetchCustomCommands();
        this.chatbotCommonService.closeChildWindow();
      });
  }

  createTimer(data: ITimer) {
    return this.api('POST', 'timers', data)
      .then((response: ITimer) => {
        this.fetchTimers();
        this.chatbotCommonService.closeChildWindow();
      });
  }

  updateDefaultCommand(slugName: string, commandName: string, data: IDefaultCommand) {
    return this.api('POST', `settings/${slugName}/commands/${commandName}`, data)
      .then((response: IChatbotAPIPostResponse) => {
        if (response.success === true) {
          this.fetchDefaultCommands();
        }
      });
  }

  updateCustomCommand(id: string, data: ICustomCommand) {
    return this.api('PUT', `commands/${id}`, data)
      .then((response: IChatbotAPIPutResponse) => {
        if (response.success === true) {
          this.fetchCustomCommands();
        }
      });
  }

  updateTimer(id: string, data: ITimer) {
    return this.api('PUT', `timers/${id}`, data)
      .then((response: IChatbotAPIPutResponse) => {
        if (response.success === true) {
          this.fetchTimers();
        }
      });
  }

  updateChatAlerts(data: IChatAlertsResponse) {
    return this.api('POST', 'settings/chat-notifications', data)
      .then((response: IChatbotAPIPostResponse) => {
        if (response.success === true) {
          this.fetchChatAlerts();
        }
      })
  }

  //
  // Mutations
  //
  @mutation()
  private LOGIN(response: IChatbotAuthResponse) {
    Vue.set(this.state, 'apiToken', response.api_token);
    Vue.set(this.state, 'socketToken', response.socket_token);
  }

  @mutation()
  private UPDATE_DEFAULT_COMMANDS(response: IDafaultCommandsResponse) {
    Vue.set(this.state, 'defaultCommandsResponse', response);
  }

  @mutation()
  private UPDATE_CUSTOM_COMMANDS(response: ICustomCommandsResponse) {
    Vue.set(this.state, 'customCommandsResponse', response);
  }

  @mutation()
  private UPDATE_COMMAND_VARIABLES(response: ICommandVariablesResponse) {
    Vue.set(this.state, 'commandVariablesResponse', response);
  }

  @mutation()
  private UPDATE_TIMERS(response: ITimersResponse) {
    Vue.set(this.state, 'timersResponse', response);
  }

  @mutation()
  private UPDATE_CHAT_ALERTS(response: IChatAlertsResponse) {
    Vue.set(this.state, 'chatAlertsResponse', response);
  }
}

export class ChatbotCommonService extends PersistentStatefulService<
  IChatbotApiServiceState
  > {
  @Inject() windowsService: WindowsService;

  closeChildWindow() {
    this.windowsService.closeChildWindow();
  }

  openCommandWindow() {
    this.windowsService.showWindow({
      componentName: 'ChatbotCommandWindow',
      size: {
        width: 650,
        height: 600
      }
    });
  }

  openTimerWindow() {
    this.windowsService.showWindow({
      componentName: 'ChatbotTimerWindow',
      size: {
        width: 650,
        height: 400
      }
    });
  }

  openChatbotAlertsWindow() {
    this.windowsService.showWindow({
      componentName: 'ChatbotAlertsWindow',
      size: {
        width: 1000,
        height: 700
      }
    })
  }
}
