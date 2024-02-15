// tiktok.ts

import { InheritMutations, ViewHandler, mutation } from '../core';
import { BasePlatformService } from './base-platform';
import {
  EPlatformCallResult,
  IPlatformRequest,
  IPlatformService,
  IPlatformState,
  TPlatformCapability,
} from './index';
import { authorizedHeaders, jfetch } from '../../util/requests';
import { throwStreamError } from '../streaming/stream-error';
import { platformAuthorizedRequest } from './utils';
import { IGoLiveSettings } from '../streaming';
import { TOutputOrientation } from 'services/restream';
import { IVideo } from 'obs-studio-node';
import { TDisplayType } from 'services/settings-v2';
import { ITikTokError, ITikTokLiveScopeResponse, ITikTokUserInfoResponse } from './tiktok/api';
import { I18nService } from 'services/i18n';
import { getDefined } from 'util/properties-type-guards';
import * as remote from '@electron/remote';

interface ITikTokServiceState extends IPlatformState {
  settings: ITikTokStartStreamSettings;
  broadcastId: string;
  streamPageUrl: string;
}

interface ITikTokStartStreamSettings {
  serverUrl: string;
  streamKey: string;
  title: string;
  liveStreamingEnabled: boolean;
  display: TDisplayType;
  video?: IVideo;
  mode?: TOutputOrientation;
}
export interface ITikTokStartStreamOptions {
  title: string;
  serverUrl: string;
  streamKey: string;
  display: TDisplayType;
}

interface ITikTokStartStreamResponse {
  name: string;
  push_key: string;
  push_url: string;
  id: string;
}

interface ITikTokEndStreamResponse {
  success: boolean;
}

interface ITikTokRequestHeaders extends Dictionary<string> {
  Accept: string;
  'Content-Type': string;
  Authorization: string;
}

@InheritMutations()
export class TikTokService
  extends BasePlatformService<ITikTokServiceState>
  implements IPlatformService {
  static initialState: ITikTokServiceState = {
    ...BasePlatformService.initialState,
    settings: {
      title: '',
      display: 'vertical',
      liveStreamingEnabled: false,
      mode: 'portrait',
      serverUrl: '',
      streamKey: '',
    },
    broadcastId: '',
    streamPageUrl: '',
  };

  readonly apiBase = 'https://open-api.tiktok.com';
  readonly platform = 'tiktok';
  readonly displayName = 'TikTok';
  readonly capabilities = new Set<TPlatformCapability>(['title', 'viewerCount']);

  authWindowOptions: Electron.BrowserWindowConstructorOptions = {
    width: 600,
    height: 800,
  };

  get authUrl() {
    const host = this.hostsService.streamlabs;
    const query = `_=${Date.now()}&skip_splash=true&external=electron&tiktok&force_verify&origin=slobs`;
    return `https://${host}/slobs/login?${query}`;
  }

  private get oauthToken() {
    return this.userService.views.state.auth?.platforms?.tiktok?.token;
  }

  get liveStreamingEnabled() {
    return this.state.settings?.liveStreamingEnabled;
  }

  /**
   * TikTok's API currently does not provide viewer count.
   * To prevent errors, return 0 for now;
   */
  get viewersCount(): number {
    return 0;
  }

  async beforeGoLive(goLiveSettings: IGoLiveSettings, display?: TDisplayType) {
    const ttSettings = getDefined(goLiveSettings.platforms.tiktok);

    let streamInfo = {} as ITikTokStartStreamResponse;

    try {
      streamInfo = await this.startStream(ttSettings);
      if (streamInfo?.id) {
        // open url if stream successfully started
        remote.shell.openExternal(this.dashboardUrl, { activate: false });
      } else {
        this.SET_ENABLED_STATUS(false);
        throwStreamError('PLATFORM_REQUEST_FAILED');
      }
    } catch (error: unknown) {
      this.SET_ENABLED_STATUS(false);
      throwStreamError('PLATFORM_REQUEST_FAILED', error as any);
    }

    const context = display ?? ttSettings?.display;

    const updatedTTSettings = {
      ...ttSettings,
      serverUrl: streamInfo.push_url,
      streamKey: streamInfo.push_key,
    };

    if (!this.streamingService.views.isMultiplatformMode) {
      this.streamSettingsService.setSettings(
        {
          streamType: 'rtmp_custom',
          key: updatedTTSettings.streamKey,
          server: updatedTTSettings.serverUrl,
        },
        context,
      );
    }

    await this.putChannelInfo(updatedTTSettings);

    this.SET_STREAM_KEY(updatedTTSettings.streamKey);
    this.SET_BROADCAST_ID(streamInfo.id);

    this.setPlatformContext('tiktok');
  }

  async afterStopStream(): Promise<void> {
    if (this.state.broadcastId) {
      await this.endStream(this.state.broadcastId);
    }
  }

  fetchNewToken(): Promise<void> {
    const host = this.hostsService.streamlabs;
    const url = `https://${host}/api/v5/slobs/tiktok/refresh`;
    const headers = authorizedHeaders(this.userService.apiToken!);
    const request = new Request(url, { headers });

    return jfetch<{ access_token: string }>(request).then(response =>
      this.userService.updatePlatformToken('tiktok', response.access_token),
    );
  }

  /**
   * Request TikTok API and wrap failed response to a unified error model
   */
  async requestTikTok<T = unknown>(reqInfo: IPlatformRequest | string): Promise<T> {
    try {
      return await platformAuthorizedRequest<T>('tiktok', reqInfo);
    } catch (e: unknown) {
      let details = (e as any).message;
      if (!details) details = 'connection failed';
      throwStreamError('PLATFORM_REQUEST_FAILED', e as any, details);
    }
  }

  async startStream(opts: ITikTokStartStreamOptions) {
    const host = this.hostsService.streamlabs;
    const url = `https://${host}/api/v5/slobs/tiktok/stream/start`;
    const headers = authorizedHeaders(this.userService.apiToken!);
    const body = new FormData();
    body.append('title', opts.title);
    const request = new Request(url, { headers, method: 'POST', body });

    return jfetch<ITikTokStartStreamResponse>(request);
  }

  async endStream(id: string) {
    const host = this.hostsService.streamlabs;
    const url = `https://${host}/api/v5/slobs/tiktok/stream/${id}/end`;
    const headers = authorizedHeaders(this.userService.apiToken!);
    const request = new Request(url, { headers, method: 'POST' });

    return jfetch<ITikTokEndStreamResponse>(request);
  }

  async fetchViewerCount(): Promise<number> {
    return 0;
  }

  /**
   * Confirm user is approved to stream to TikTok
   */
  async validatePlatform(): Promise<EPlatformCallResult> {
    try {
      const response = await this.fetchLiveAccessStatus();
      if (response) {
        const status = response as ITikTokLiveScopeResponse;
        this.SET_ENABLED_STATUS(status?.can_be_live);

        return EPlatformCallResult.Success;
      } else {
        this.SET_ENABLED_STATUS(false);
        return EPlatformCallResult.TikTokStreamScopeMissing;
      }
    } catch (e: unknown) {
      console.warn(this.getErrorMessage(e));
      this.SET_ENABLED_STATUS(false);
      return EPlatformCallResult.TikTokStreamScopeMissing;
    }
  }

  /**
   * Get if user is approved by TikTok to stream to TikTok
   * @remark Only users approved by TikTok are allowed to generate
   * stream keys. It is possible that users have received approval
   * since the last time that they logged in using TikTok, so get this
   * status every time the user sets the go live settings.
   */
  async fetchLiveAccessStatus(): Promise<void | ITikTokLiveScopeResponse | ITikTokError> {
    const host = this.hostsService.streamlabs;
    const url = `https://${host}/api/v5/slobs/tiktok/info`;
    const headers = authorizedHeaders(this.userService.apiToken);
    const request = new Request(url, { headers });
    return jfetch<ITikTokError>(request).catch(() => {
      console.warn('Error fetching TikTok Live Access status.');
    });
  }

  async fetchProfileUrl(): Promise<string> {
    const url = `${this.apiBase}/user/info/`;
    const headers = this.getHeaders({ url });

    return this.requestTikTok<ITikTokUserInfoResponse>({
      headers,
      url,
      method: 'POST',
      body: JSON.stringify({
        access_token: this.oauthToken,
        fields: ['profile_deep_link'],
      }),
    }).then(json => {
      return json.data.user.profile_deep_link;
    });
  }

  /**
   * prepopulate channel info and save it to the store
   */
  async prepopulateInfo(): Promise<void> {
    // fetch user live access status
    await this.validatePlatform();

    // fetch stream page url to open
    const streamPageUrl = await this.fetchProfileUrl();
    this.SET_STREAM_PAGE_URL(streamPageUrl);

    this.SET_PREPOPULATED(true);
  }

  async putChannelInfo(settings: ITikTokStartStreamOptions): Promise<void> {
    this.UPDATE_STREAM_SETTINGS(settings);
  }

  getHeaders(req: IPlatformRequest, useToken?: string | boolean): ITikTokRequestHeaders {
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.oauthToken}`,
    };
  }

  getErrorMessage(error?: any) {
    switch (error) {
      case error?.message:
        return error?.message;
      case error?.error_description:
        return error?.error_description;
      case error?.http_status_code:
        return error?.http_status_code;
      default:
        return 'Error processing TikTok request.';
    }
  }

  get liveDockEnabled(): boolean {
    return true;
  }

  get streamPageUrl(): string {
    return this.state.streamPageUrl;
  }

  get chatUrl(): string {
    return '';
  }

  get dashboardUrl(): string {
    return `https://livecenter.tiktok.com/live_monitor?lang=${this.locale}`;
  }

  get infoUrl(): string {
    return `https://streamlabs.com/content-hub/post/how-to-livestream-from-your-tiktok-account-using-streamlabs-from-web?lang=${this.locale}`;
  }

  get applicationUrl(): string {
    return `https://www.tiktok.com/falcon/live_g/live_access_pc_apply/intro/index.html?id=${this.id}&lang=${this.locale}`;
  }

  get locale(): string {
    return I18nService.instance.state.locale;
  }

  // TODO: replace temporary string with `official activity ID`
  get id(): string {
    return 'GL6399433079641606942';
  }

  @mutation()
  protected SET_BROADCAST_ID(id: string) {
    this.state.broadcastId = id;
  }

  @mutation()
  SET_ENABLED_STATUS(status: boolean) {
    const updatedSettings = { ...this.state.settings, liveStreamingEnabled: status };
    this.state.settings = updatedSettings;
  }

  @mutation()
  protected SET_STREAM_PAGE_URL(streamPageUrl: string) {
    this.state.streamPageUrl = streamPageUrl;
  }
}
