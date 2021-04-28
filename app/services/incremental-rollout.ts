import { Inject } from 'services/core/injector';
import { authorizedHeaders, jfetch } from 'util/requests';
import { mutation, StatefulService } from 'services/core/stateful-service';
import { UserService } from 'services/user';
import { HostsService } from './hosts';
import Utils from 'services/utils';
import { InitAfter } from './core';

export enum EAvailableFeatures {
  platform = 'slobs--platform',
  creatorSites = 'slobs--creator-sites',
  facebookOnboarding = 'slobs--facebook-onboarding',
  twitter = 'slobs--twitter',
  restream = 'slobs--restream',
  reactGoLive = 'slobs--react-golive',
}

interface IIncrementalRolloutServiceState {
  availableFeatures: string[];
}

@InitAfter('UserService')
export class IncrementalRolloutService extends StatefulService<IIncrementalRolloutServiceState> {
  @Inject() private userService: UserService;
  @Inject() private hostsService: HostsService;

  static initialState: IIncrementalRolloutServiceState = {
    availableFeatures: [],
  };

  init() {
    this.userService.userLogin.subscribe(() => this.fetchAvailableFeatures());
    this.userService.userLogout.subscribe(() => this.resetAvailableFeatures());
  }

  @mutation()
  private SET_AVAILABLE_FEATURES(features: string[]) {
    this.state.availableFeatures = features;
  }

  get availableFeatures() {
    return this.state.availableFeatures || [];
  }

  featureIsEnabled(feature: EAvailableFeatures): boolean {
    if (Utils.isDevMode()) return true; // always show for dev mode

    return this.availableFeatures.indexOf(feature) > -1;
  }

  fetchAvailableFeatures() {
    if (this.userService.isLoggedIn) {
      const host = this.hostsService.streamlabs;
      const url = `https://${host}/api/v5/slobs/available-features`;
      const headers = authorizedHeaders(this.userService.apiToken);
      const request = new Request(url, { headers });

      return jfetch<{ features: string[] }>(request).then(response => {
        this.SET_AVAILABLE_FEATURES(response.features);
      });
    }
  }

  resetAvailableFeatures() {
    this.SET_AVAILABLE_FEATURES([]);
  }
}
