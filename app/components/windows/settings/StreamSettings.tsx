import { Component } from 'vue-property-decorator';
import { Inject } from 'services/core/injector';
import cx from 'classnames';
import { $t } from 'services/i18n';
import { ISettingsSubCategory } from 'services/settings';
import TsxComponent from 'components/tsx-component';
import { StreamSettingsService } from '../../../services/settings/streaming';
import GenericFormGroups from '../../obs/inputs/GenericFormGroups.vue';
import { UserService } from 'services/user';
import styles from './StreamSettings.m.less';
import PlatformLogo from 'components/shared/PlatformLogo';
import { RestreamService } from 'services/restream';
import { ToggleInput } from 'components/shared/inputs/inputs';
import VFormGroup from 'components/shared/inputs/VFormGroup.vue';
import { metadata } from 'components/shared/inputs';

@Component({ components: { GenericFormGroups, PlatformLogo } })
export default class StreamSettings extends TsxComponent {
  @Inject() private streamSettingsService: StreamSettingsService;
  @Inject() private userService: UserService;
  @Inject() private restreamService: RestreamService;
  private obsSettings = this.streamSettingsService.getObsStreamSettings();

  saveObsSettings(obsSettings: ISettingsSubCategory[]) {
    this.streamSettingsService.setObsStreamSettings(obsSettings);
    this.obsSettings = this.streamSettingsService.getObsStreamSettings();
  }

  disableProtectedMode() {
    this.streamSettingsService.setSettings({ protectedModeEnabled: false });
  }

  restoreDefaults() {
    this.streamSettingsService.resetStreamSettings();
  }

  get protectedModeEnabled(): boolean {
    return this.streamSettingsService.protectedModeEnabled;
  }

  get userName() {
    return this.userService.platform.username;
  }

  get platform() {
    return this.userService.platform.type;
  }

  get platformName() {
    return this.formattedPlatformName(this.platform);
  }

  formattedPlatformName(platform: string) {
    return platform.charAt(0).toUpperCase() + this.platform.slice(1);
  }

  get needToShowWarning() {
    return this.userService.isLoggedIn() && !this.protectedModeEnabled;
  }

  get restreamEnabled() {
    return this.restreamService.state.enabled;
  }

  set restreamEnabled(enabled: boolean) {
    this.restreamService.setEnabled(enabled);
  }

  get restreamEligible() {
    return this.restreamService.restreamEligible;
  }

  render() {
    return (
      <div>
        {/* account info */}
        {this.protectedModeEnabled && (
          <div>
            {this.restreamEligible && (
              <div class="section">
                <VFormGroup
                  vModel={this.restreamEnabled}
                  metadata={metadata.toggle({
                    title: $t('Enable Restreaming'),
                    description: $t(
                      'Restreaming allows you to stream to multiple platforms simultaneously.',
                    ),
                  })}
                />
              </div>
            )}
            <div class="section flex">
              <div class="margin-right--20">
                <PlatformLogo platform={this.platform} class={styles.platformLogo} />
              </div>
              <div>
                {$t('Streaming to %{platformName}', { platformName: this.platformName })} <br />
                {this.userName} <br />
              </div>
            </div>
            {this.restreamEnabled && this.userService.state.auth.platforms.facebook && (
              <div class="section flex">
                <div class="margin-right--20">
                  <PlatformLogo platform={'facebook'} class={styles.platformLogo} />
                </div>
                <div>
                  {$t('Streaming to %{platformName}', { platformName: 'facebook' })} <br />
                  {this.userService.state.auth.platforms.facebook.username} <br />
                </div>
              </div>
            )}
            <div>
              <a onClick={this.disableProtectedMode}>{$t('Stream to custom ingest')}</a>
            </div>
          </div>
        )}

        {/* WARNING message */}
        {this.needToShowWarning && (
          <div class="section section--warning">
            <b>{$t('Warning')}: </b>
            {$t(
              'Streaming to a custom ingest is advanced functionality. Some features of Streamlabs OBS may stop working as expected',
            )}
            <br />
            <br />
            <button class="button button--warn" onClick={this.restoreDefaults}>
              {$t('Use recommended settings')}
            </button>
          </div>
        )}

        {/* OBS settings */}
        {!this.protectedModeEnabled && (
          <GenericFormGroups value={this.obsSettings} onInput={this.saveObsSettings} />
        )}
      </div>
    );
  }
}
