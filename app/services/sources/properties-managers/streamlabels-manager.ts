import { DefaultManager, IDefaultManagerSettings } from './default-manager';
import { Inject } from 'services/core/injector';
import { StreamlabelsService, IStreamlabelSubscription } from 'services/streamlabels';
import { UserService } from 'services/user';

export interface IStreamlabelsManagerSettings extends IDefaultManagerSettings {
  statname: string;
}

export class StreamlabelsManager extends DefaultManager {
  @Inject() streamlabelsService: StreamlabelsService;
  @Inject() userService: UserService;

  settings: IStreamlabelsManagerSettings;
  blacklist = ['text', 'read_from_file'];
  oldOutput: string = null;
  customUIComponent = 'StreamlabelProperties';

  init() {
    this.streamlabelsService.output.subscribe(output => {
      if (output[this.settings.statname] !== this.oldOutput) {
        this.oldOutput = output[this.settings.statname];
        this.obsSource.update({
          ...this.obsSource.settings,
          read_from_file: false,
          text: output[this.settings.statname],
        });
      }
    });
  }

  destroy() {
    this.streamlabelsService.output.unsubscribe();
  }

  normalizeSettings() {
    const youtubeKeys = {
      most_recent_follower: 'most_recent_youtube_subscriber',
      session_followers: 'session_youtube_subscribers',
      session_follower_count: 'session_youtube_subscriber_count',
      session_most_recent_follower: 'session_most_recent_youtube_subscriber',
      total_subscriber_count: 'total_youtube_sponsor_count',
      most_recent_subscriber: 'most_recent_youtube_sponsor',
      session_subscribers: 'session_youtube_sponsors',
      session_subscriber_count: 'session_youtube_sponsor_count',
      session_most_recent_subscriber: 'session_most_recent_youtube_sponsor',
    };

    const mixerKeys = {
      most_recent_follower: 'most_recent_mixer_follower',
      session_followers: 'session_mixer_followers',
      session_follower_count: 'session_mixer_follower_count',
      session_most_recent_follower: 'session_most_recent_mixer_follower',
      most_recent_subscriber: 'most_recent_mixer_subscriber',
      session_subscribers: 'session_mixer_subscribers',
      session_subscriber_count: 'session_mixer_subscriber_count',
      session_most_recent_subscriber: 'session_most_recent_mixer_subscriber',
    };

    if (this.userService.platform) {
      if (this.userService.platform.type === 'youtube') {
        if (youtubeKeys[this.settings.statname]) {
          this.settings.statname = youtubeKeys[this.settings.statname];
        }
      }

      if (this.userService.platform.type === 'mixer') {
        if (mixerKeys[this.settings.statname]) {
          this.settings.statname = mixerKeys[this.settings.statname];
        }
      }
    }
  }

  applySettings(settings: Dictionary<any>) {
    if (settings.statname !== this.settings.statname) {
      this.obsSource.update({
        text: this.streamlabelsService.output.getValue()[settings.statname],
      });
    }

    this.settings = {
      // Default to All-Time Top Donator
      statname: 'all_time_top_donator',
      ...this.settings,
      ...settings,
    };

    this.normalizeSettings();
  }
}
