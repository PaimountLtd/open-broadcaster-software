import { ISettingsSubCategory } from '../../settings/index';

export interface ITcpServersSettings {
  token: string;
  namedPipe: {
    enabled: boolean;
    pipeName: string;
  };
  websockets: {
    enabled: boolean;
    port: number;
    allowRemote: boolean;
  };
  remoteConnection: {
    enabled: boolean;
    connectedDevices: IConnectedDevice[];
  };
}

export interface IConnectedDevice {
  socketId: string;
  deviceName: string;
  clientType: string;
}

export interface ITcpServerServiceApi {
  getApiSettingsFormData(): ISettingsSubCategory[];
  setSettings(settings: Partial<ITcpServersSettings>): void;
  getSettings(): ITcpServersSettings;
  getDefaultSettings(): ITcpServersSettings;
  listen(): void;
  stopListening(): void;
  enableWebsoketsRemoteConnections(): void;
  websocketRemoteConnectionEnabled: boolean;
  getIPAddresses(): IIPAddressDescription[];
  generateToken(): string;
  state: ITcpServersSettings;
}

export interface IIPAddressDescription {
  address: string;
  interface: string;
  family: 'IPv4' | 'IPv6';
  internal: boolean;
}
