import Vue from 'vue';
import { PersistentStatefulService } from '../persistent-stateful-service';
import { mutation } from 'services/stateful-service';
import { UserService } from 'services/user';
import { Inject } from 'util/injector';
import { handleErrors, authorizedHeaders } from 'util/requests';
import { WindowsService } from 'services/windows';

import {
  IChatbotApiServiceState,
  IChatbotCommonServiceState,
  IChatbotAuthResponse,
  IChatbotErrorResponse,
  IChatbotStatusResponse,
  ChatbotClients,
  ICustomCommand,
  IDefaultCommand,
  IChatbotTimer,
  IDafaultCommandsResponse,
  ICustomCommandsResponse,
  ITimersResponse,
  IChatbotAPIPostResponse,
  IChatbotAPIPutResponse,
  IChatbotAPIDeleteResponse,
  ICommandVariablesResponse,
  IChatAlertsResponse,
  ICapsProtectionResponse,
  ISymbolProtectionResponse,
  ILinkProtectionResponse,
  IWordProtectionResponse,
  ChatbotSettingSlugs
} from './index';

export class ChatbotApiService extends PersistentStatefulService<IChatbotApiServiceState> {
  @Inject() userService: UserService;
  @Inject() chatbotCommonService: ChatbotCommonService;

  apiUrl = 'https://chatbot-api.streamlabs.com/';
  version = 'api/v1/';

  static defaultState: IChatbotApiServiceState = {
    apiToken: null,
    socketToken: null,
    globallyEnabled: false,
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
    },
    capsProtectionResponse: {
      enabled: false,
      settings: null
    },
    symbolProtectionResponse: {
      enabled: false,
      settings: null
    },
    linkProtectionResponse: {
      enabled: false,
      settings: null
    },
    wordProtectionResponse: {
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

  logOut() {
    this.LOGOUT();
  }

  private apiEndpoint(route: String, versionIncluded?: Boolean) {
    return `${this.apiUrl}${versionIncluded ? this.version : ''}${route}`;
  }

  private api(method: string, endpoint: string, data: any) {
    const url = this.apiEndpoint(endpoint, true);
    const headers = authorizedHeaders(this.state.apiToken);
    let options: {
      headers: Headers;
      method: string;
      body?: string;
    } = {
      headers,
      method
    };
    if (method.toLowerCase() === 'post' || method.toLowerCase() === 'put') {
      options.headers.append('Content-Type', 'application/json');
      options.body = JSON.stringify(data || {});
    }
    const request = new Request(url, options);

    return fetch(request)
      .then(handleErrors)
      .then(response => {
        return response.json();
      })
      .catch(error => {
        // errors contain string response. Need to json()
        // and return the promised error
        return error
          .json()
          .then((errJson: Promise<IChatbotErrorResponse>) =>
            Promise.reject(errJson)
          );
      });
  }

  //
  // GET requests
  //

  fetchChatbotGlobalEnabled() {
    return this.api('GET', 'status', {}).then(
      (response: IChatbotStatusResponse) => {
        // check for clients
        const allclientsOnline = ChatbotClients.every((client: string) => {
          return response.clients.services.indexOf(client) > -1;
        });
        // all status online.
        this.UPDATE_GLOBALLY_ENABLED(
          response.worker.status === 'Online' &&
            response.worker.type === 'Full' &&
            response.clients.status === 'Online' &&
            allclientsOnline
        );
      }
    );
  }

  fetchDefaultCommands() {
    return this.api('GET', 'commands/default', {}).then(
      (response: IDafaultCommandsResponse) => {
        this.UPDATE_DEFAULT_COMMANDS(response);
      }
    );
  }

  fetchCustomCommands(page = 1, query = '') {
    return this.api('GET', `commands?page=${page}&query=${query}`, {}).then(
      (response: ICustomCommandsResponse) => {
        this.UPDATE_CUSTOM_COMMANDS(response);
      }
    );
  }

  fetchCommandVariables() {
    return this.api('GET', 'commands/variables', {}).then(
      (response: ICommandVariablesResponse) => {
        this.UPDATE_COMMAND_VARIABLES(response);
      }
    );
  }

  fetchTimers(page = 1, query = '') {
    return this.api('GET', `timers?page=${page}&query=${query}`, {}).then(
      (response: ITimersResponse) => {
        this.UPDATE_TIMERS(response);
      }
    );
  }

  fetchChatAlerts() {
    return this.api('GET', 'settings/chat-notifications', {}).then(
      (response: IChatAlertsResponse) => {
        this.UPDATE_CHAT_ALERTS(response);
      }
    );
  }

  fetchCapsProtection() {
    return this.api('GET', 'settings/caps-protection', {}).then(
      (response: ICapsProtectionResponse) => {
        this.UPDATE_CAPS_PROTECTION(response);
      }
    );
  }

  fetchSymbolProtection() {
    return this.api('GET', 'settings/symbol-protection', {}).then(
      (response: ISymbolProtectionResponse) => {
        this.UPDATE_SYMBOL_PROTECTION(response);
      }
    );
  }

  fetchLinkProtection() {
    return this.api('GET', 'settings/link-protection', {}).then(
      (response: ILinkProtectionResponse) => {
        this.UPDATE_LINK_PROTECTION(response);
      }
    );
  }

  fetchWordProtection() {
    return this.api('GET', 'settings/words-protection', {}).then(
      (response: IWordProtectionResponse) => {
        this.UPDATE_WORD_PROTECTION(response);
      }
    );
  }

  //
  // POST, PUT requests
  //

  resetSettings(slug: ChatbotSettingSlugs) {
    return this.api('POST', `settings/${slug}/reset`, {}).then(
      (
        response:
          | IChatAlertsResponse
          | ICapsProtectionResponse
          | ISymbolProtectionResponse
          | ILinkProtectionResponse
          | IWordProtectionResponse
      ) => {
        switch (slug) {
          case 'chat-notifications':
            this.UPDATE_CHAT_ALERTS(response as IChatAlertsResponse);
          case 'caps-protection':
            this.UPDATE_CAPS_PROTECTION(response as ICapsProtectionResponse);
            break;
          case 'symbol-protection':
            this.UPDATE_SYMBOL_PROTECTION(
              response as ISymbolProtectionResponse
            );
            break;
          case 'link-protection':
            this.UPDATE_LINK_PROTECTION(response as ILinkProtectionResponse);
            break;
          case 'words-protection':
            this.UPDATE_WORD_PROTECTION(response as IWordProtectionResponse);
            break;
        }
        return Promise.resolve(response);
      }
    );
  }

  toggleEnableChatbot() {
    const platforms = ChatbotClients.map(client => client.toLowerCase());
    return Promise.all(
      platforms.map(platform => {
        return this.state.globallyEnabled
          ? this.leavePlatformChannel(platform)
          : this.joinPlatformChannel(platform);
      })
    ).then((response: IChatbotAPIPostResponse[]) => {
      this.fetchChatbotGlobalEnabled();
    });
  }

  joinPlatformChannel(platform: string) {
    return this.api('POST', `bot/${platform}/join`, {});
  }

  leavePlatformChannel(platform: string) {
    return this.api('POST', `bot/${platform}/part`, {});
  }

  resetDefaultCommands() {
    return this.api('POST', 'commands/default/reset', {}).then(
      (response: IDafaultCommandsResponse) => {
        this.UPDATE_DEFAULT_COMMANDS(response);
      }
    );
  }

  resetDefaultCommand(slugName: string, commandName: string) {
    return this.api(
      'POST',
      `settings/${slugName}/commands/${commandName}/reset`,
      {}
    ).then((response: IDefaultCommand) => {
      return Promise.resolve(response);
    });
  }

  createCustomCommand(data: ICustomCommand) {
    return this.api('POST', 'commands', data).then(
      (response: ICustomCommand) => {
        this.fetchCustomCommands();
        this.chatbotCommonService.closeChildWindow();
      }
    );
  }

  createTimer(data: IChatbotTimer) {
    return this.api('POST', 'timers', data).then((response: IChatbotTimer) => {
      this.fetchTimers();
      this.chatbotCommonService.closeChildWindow();
    });
  }

  updateDefaultCommand(
    slugName: string,
    commandName: string,
    data: IDefaultCommand
  ) {
    return this.api(
      'POST',
      `settings/${slugName}/commands/${commandName}`,
      data
    ).then((response: IChatbotAPIPostResponse) => {
      if (response.success === true) {
        this.fetchDefaultCommands();
        this.chatbotCommonService.closeChildWindow();
      }
    });
  }

  updateCustomCommand(id: string, data: ICustomCommand) {
    return this.api('PUT', `commands/${id}`, data).then(
      (response: IChatbotAPIPutResponse) => {
        if (response.success === true) {
          this.fetchCustomCommands();
          this.chatbotCommonService.closeChildWindow();
        }
      }
    );
  }

  updateTimer(id: string, data: IChatbotTimer) {
    return this.api('PUT', `timers/${id}`, data).then(
      (response: IChatbotAPIPutResponse) => {
        if (response.success === true) {
          this.fetchTimers();
          this.chatbotCommonService.closeChildWindow();
        }
      }
    );
  }

  updateChatAlerts(data: IChatAlertsResponse) {
    return this.api('POST', 'settings/chat-notifications', data).then(
      (response: IChatbotAPIPostResponse) => {
        if (response.success === true) {
          this.fetchChatAlerts();
        }
      }
    );
  }

  updateCapsProtection(data: ICapsProtectionResponse) {
    return this.api('POST', 'settings/caps-protection', data).then(
      (response: IChatbotAPIPostResponse) => {
        if (response.success === true) {
          this.fetchCapsProtection();
        }
      }
    );
  }

  updateSymbolProtection(data: ISymbolProtectionResponse) {
    return this.api('POST', 'settings/symbol-protection', data).then(
      (response: IChatbotAPIPostResponse) => {
        if (response.success === true) {
          this.fetchSymbolProtection();
        }
      }
    );
  }

  updateLinkProtection(data: ILinkProtectionResponse) {
    return this.api('POST', 'settings/link-protection', data).then(
      (response: IChatbotAPIPostResponse) => {
        if (response.success === true) {
          this.fetchLinkProtection();
        }
      }
    );
  }

  updateWordProtection(data: IWordProtectionResponse) {
    return this.api('POST', 'settings/words-protection', data).then(
      (response: IChatbotAPIPostResponse) => {
        if (response.success === true) {
          this.fetchWordProtection();
        }
      }
    );
  }

  //
  // DELETE methods
  //

  deleteCustomCommand(id: string) {
    return this.api('DELETE', `commands/${id}`, {}).then(
      (response: IChatbotAPIDeleteResponse) => {
        if (response.success === true) {
          this.fetchCustomCommands();
        }
      }
    );
  }

  deleteTimer(id: string) {
    return this.api('DELETE', `timers/${id}`, {}).then(
      (response: IChatbotAPIDeleteResponse) => {
        if (response.success === true) {
          this.fetchTimers();
        }
      }
    );
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
  private LOGOUT() {
    Vue.set(this.state, 'apiToken', null);
    Vue.set(this.state, 'socketToken', null);
  }

  @mutation()
  private UPDATE_GLOBALLY_ENABLED(enabled: boolean) {
    Vue.set(this.state, 'globallyEnabled', enabled);
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

  @mutation()
  private UPDATE_CAPS_PROTECTION(response: ICapsProtectionResponse) {
    Vue.set(this.state, 'capsProtectionResponse', response);
  }

  @mutation()
  private UPDATE_SYMBOL_PROTECTION(response: ISymbolProtectionResponse) {
    Vue.set(this.state, 'symbolProtectionResponse', response);
  }

  @mutation()
  private UPDATE_LINK_PROTECTION(response: ILinkProtectionResponse) {
    Vue.set(this.state, 'linkProtectionResponse', response);
  }

  @mutation()
  private UPDATE_WORD_PROTECTION(response: IWordProtectionResponse) {
    Vue.set(this.state, 'wordProtectionResponse', response);
  }
}

export class ChatbotCommonService extends PersistentStatefulService<IChatbotCommonServiceState> {
  @Inject() windowsService: WindowsService;

  static defaultState: IChatbotCommonServiceState = {
    toasted: null,
    customCommandToUpdate: null,
    defaultCommandToUpdate: null,
    timerToUpdate: null,
    modBannerVisible: true
  };

  hideModBanner() {
    this.HIDE_MOD_BANNER();
  }

  showModBanner() {
    this.SHOW_MOD_BANNER();
  }

  closeChildWindow() {
    this.windowsService.closeChildWindow();
  }

  openCustomCommandWindow(command?: ICustomCommand) {
    if (command) {
      this.SET_CUSTOM_COMAND_TO_UPDATE(command);
    }
    this.windowsService.showWindow({
      componentName: 'ChatbotCustomCommandWindow',
      size: {
        width: 650,
        height: 600
      }
    });
  }

  openDefaultCommandWindow(command: IDefaultCommand) {
    if (command) {
      this.SET_DEFAULT_COMAND_TO_UPDATE(command);
    }
    this.windowsService.showWindow({
      componentName: 'ChatbotDefaultCommandWindow',
      size: {
        width: 650,
        height: 650
      }
    });
  }

  openTimerWindow(timer?: IChatbotTimer) {
    if (timer) {
      this.SET_TIMER_TO_UPDATE(timer);
    }
    this.windowsService.showWindow({
      componentName: 'ChatbotTimerWindow',
      size: {
        width: 650,
        height: 500
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

  openCapsProtectionWindow() {
    this.windowsService.showWindow({
      componentName: 'ChatbotCapsProtectionWindow',
      size: {
        width: 650,
        height: 500
      }
    });
  }

  openSymbolProtectionWindow() {
    this.windowsService.showWindow({
      componentName: 'ChatbotSymbolProtectionWindow',
      size: {
        width: 650,
        height: 500
      }
    });
  }

  openLinkProtectionWindow() {
      this.windowsService.showWindow({
      componentName: 'ChatbotLinkProtectionWindow',
      size: {
        width: 650,
        height: 650
      }
    });
  }

  openWordProtectionWindow() {
    this.windowsService.showWindow({
      componentName: 'ChatbotWordProtectionWindow',
      size: {
        width: 650,
        height: 500
      }
    });
  }

  @mutation()
  private HIDE_MOD_BANNER() {
    Vue.set(this.state, 'modBannerVisible', false);
  }

  @mutation()
  private SHOW_MOD_BANNER() {
    Vue.set(this.state, 'modBannerVisible', true);
  }

  @mutation()
  private SET_CUSTOM_COMAND_TO_UPDATE(command: ICustomCommand) {
    Vue.set(this.state, 'customCommandToUpdate', command);
  }

  @mutation()
  private SET_DEFAULT_COMAND_TO_UPDATE(command: IDefaultCommand) {
    Vue.set(this.state, 'defaultCommandToUpdate', command);
  }

  @mutation()
  private SET_TIMER_TO_UPDATE(timer: IChatbotTimer) {
    Vue.set(this.state, 'timerToUpdate', timer);
  }
}
