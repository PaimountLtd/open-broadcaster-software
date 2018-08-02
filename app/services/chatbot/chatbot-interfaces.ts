
// state
export interface IChatbotApiServiceState {
  apiToken: string;
  socketToken: string;
  defaultCommandsResponse: IDafaultCommandsResponse;
  customCommandsResponse: ICustomCommandsResponse;
  timersResponse: ITimersResponse;
  commandVariablesResponse: ICommandVariablesResponse;
  chatAlertsResponse: IChatAlertsResponse;
  capsProtectionResponse: ICapsProtectionResponse;
  symbolProtectionResponse: ISymbolProtectionResponse;
  linkProtectionResponse: ILinkProtectionResponse;
  wordProtectionResponse: IWordProtectionResponse;
}

export interface IChatbotCommonServiceState {
  toasted: any;
}

// responses
export interface IChatbotAuthResponse {
  api_token: string;
  socket_token: string;
}

export interface IChatbotAPIPostResponse {
  success: boolean;
}

export interface IChatbotAPIPutResponse {
  success: boolean;
}

export interface IDafaultCommandsResponse {
  commands: IDafaultCommandsSlug;
  'link-protection': IDafaultCommandsSlug;
  giveaway: IDafaultCommandsSlug;
}

export interface ICustomCommandsResponse {
  pagination: IPagination;
  data: ICustomCommandsData;
}

export interface ICommandVariablesResponse {
  [id: number] : ICommandVariables;
}

export interface ITimersResponse {
  pagination: IPagination;
  data: ITimersData;
}

export interface IChatAlertsResponse {
  settings: IChatAlertsData;
  enabled: boolean;
}

export interface ICapsProtectionResponse {
  settings: ICapsProtectionData;
  enabled: boolean;
}

export interface ISymbolProtectionResponse {
  settings: ISymbolProtectionData;
  enabled: boolean;
}

export interface ILinkProtectionResponse {
  settings: ILinkProtectionData;
  enabled: boolean;
}

export interface IWordProtectionResponse {
  settings: IWordProtectionData;
  enabled: boolean;
}


// shared
export interface IPermission {
  level: number;
  info?: IPermissionInfo;
}

export interface IPermissionInfo {
  [id: string]: any;
}

export interface ICooldown {
  global: number;
  user: number;
}

export interface IAliases {
  [id: number]: string;
}

export interface IPagination {
  current: number;
  total: number;
}

export interface IPunishment {
  duration: number;
  type: string;
}

export interface IExcluded extends IPermission {}


// default commands
export interface IDefaultCommand {
  command: string;
  description: string;
  aliases: IAliases;
  response_type: string;
  success_response?: string;
  failed_response?: string;
  response?: string;
  static_permission?: IPermission;
  permission?: IPermission;
  enabled?: boolean;
  enabled_response?: string;
  disabled_response?: string;
}

export interface IDafaultCommandsSlug {
  [id: string]: IDefaultCommand;
}

// custom commands
export interface ICustomCommandsData {
  [id: number]: ICustomCommand;
}


export interface ICustomCommandRow {
  id?: string;
  user_id?: number;
  command: string;
  permission: IPermission;
  response: string;
  response_type?: string;
  cooldowns: ICooldown;
  aliases: IAliases;
  platforms: number;
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
}


export interface ICustomCommand {
  id?: string;
  user_id?: number;
  command: string;
  permission: IPermission;
  response: string;
  response_type?: string;
  cooldowns: ICooldown;
  aliases: IAliases;
  platforms: number;
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

// command variables
export interface ICommandVariables {
  [id: string]: any
}

// timers
export interface ITimersData {
  [id: number]: ITimer;
}

export interface ITimer {
  id?: string;
  user_id?: number;
  name: string;
  interval: number;
  chat_lines: number;
  message: string;
  platforms: number;
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

// modules
export interface IChatbotModule {
  title: string;
  description: string;
  backgroundUrl: string;
  enabled: boolean;
  onToggleEnabled: Function;
  onExpand: Function;
}

// chat alerts
export interface IChatAlertsData {
  [id: string]: {
    [id: string]: IAlertType;
  }
}

export interface IAlertType {
  enabled: boolean;
  messages: IAlertMessage[];
}

export interface IAlertMessage {
  message: string;
  amount?: number;
  is_gifted?: boolean;
  tier?: string;
}

// protections
export interface IProtectionGeneral {
  punishment: IPunishment;
  excluded: IExcluded;
  message: string;
}

export interface IProtectionAdvanced {
  minimum?: number;
  maximum?: number;
  percent?: number;
}

export interface IProtectionList<type> {
  [id: number]: type;
}


// caps protection data
export interface ICapsProtectionData {
  general: IProtectionGeneral;
  advanced: IProtectionAdvanced;
}

// symbol protection data
export interface ISymbolProtectionData {
  general: IProtectionGeneral;
  advanced: IProtectionAdvanced;
}
// link protection data
export interface ILinkProtectionData {
  commands: ILinkProtectionCommands;
  general: IProtectionGeneral;
  whitelist: IProtectionList<string>;
  blacklist: IProtectionList<string>;
}

export interface ILinkProtectionCommands {
  [id: string]: ILinkProtectionCommand;
}

export interface ILinkProtectionCommand {
  command: string;
  description: string;
  response: string;
  response_type: string;
  aliases: IAliases;
}

// words protection data
export interface IWordProtectionData {
  general: IProtectionGeneral;
  blacklist: IProtectionList<IWordProtectionBlackListItem>;
}

export interface IWordProtectionBlackListItem {
  text: string;
  is_regex: boolean;
  punishment: IPunishment;
}


// dictionaries
export enum ChatbotPermissions {
  None = 0,
  Viewer = 1,
  Subscriber = 1 << 1,
  Moderator = 1 << 5,
  Broadcaster = 1 << 7,
  All = Viewer | Subscriber | Moderator | Broadcaster
}

export enum ChatbotPunishments {
  Purge = 'Purge',
  Timeout = 'Timeout',
  Ban = 'Ban'
}

export enum ChatbotResponseTypes {
  Chat = 'Chat',
  Whisper = 'Whisper'
}