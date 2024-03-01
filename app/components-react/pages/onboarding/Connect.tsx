import React, { useState, useContext } from 'react';
import styles from './Connect.m.less';
import commonStyles from './Common.m.less';
import { $t } from 'services/i18n';
import { Services } from 'components-react/service-provider';
import { injectState, useModule, mutation } from 'slap';
import { ExtraPlatformConnect } from './ExtraPlatformConnect';
import { EPlatform, EPlatformCallResult, TPlatform, platformLabels } from 'services/platforms';
import cx from 'classnames';
import * as remote from '@electron/remote';
import { OnboardingModule } from './Onboarding';
import PlatformLogo from 'components-react/shared/PlatformLogo';
import { EAuthProcessState } from 'services/user';
import { ListInput } from 'components-react/shared/inputs';
import Form from 'components-react/shared/inputs/Form';
import Signup from './Signup';
import { SkipContext } from './OnboardingContext';
import PlatformButton, { PlatformIconButton } from 'components-react/shared/PlatformButton';
import Translate from 'components-react/shared/Translate';

export function Connect() {
  const ctx = useContext(SkipContext);

  const {
    isRelog,
    selectedExtraPlatform,
    loading,
    authInProgress,
    authPlatform,
    setExtraPlatform,
  } = useModule(LoginModule);
  const { next, isLogin } = useModule(OnboardingModule);
  // If we come from login singleton view, default to false
  const [isSignup, setIsSignup] = useState(() => !isLogin);
  const { UsageStatisticsService, OnboardingService, RecordingModeService } = Services;

  if (selectedExtraPlatform) {
    return <ExtraPlatformConnect />;
  }

  function onSkip() {
    if (loading || authInProgress) {
      return;
    }

    next();

    // Do not run default skip
    return false;
  }

  ctx.onSkip = onSkip;

  function onSelectExtraPlatform(val: TExtraPlatform | 'tiktok' | undefined) {
    if (val === 'tiktok') {
      authPlatform('tiktok', afterLogin);
      return;
    }

    UsageStatisticsService.recordAnalyticsEvent('PlatformLogin', val);
    setExtraPlatform(val);
  }

  function afterLogin() {
    OnboardingService.actions.setExistingCollections();
    /* Since this is the only component that uses custom skip step, might be fine
     * do this this reset default here but revisit if this ever changes
     */
    ctx.onSkip = () => true;
    next();
  }

  // streamlabs and trovo are added separarely on markup below
  const platforms = RecordingModeService.views.isRecordingModeEnabled
    ? ['youtube']
    : ['twitch', 'youtube', 'facebook', 'twitter'];

  const shouldAddTrovo = !RecordingModeService.views.isRecordingModeEnabled;

  const extraPlatforms: {
    value: 'tiktok' | TExtraPlatform;
    label: string;
    image: string;
  }[] = [
    {
      value: 'tiktok',
      label: 'TikTok',
      image:
        'data:image/png;base64,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',
    },
    {
      value: 'dlive',
      label: 'Dlive',
      image: require('../../../../media/images/platforms/dlive-logo-small.png'),
    },
    {
      value: 'nimotv',
      label: 'NimoTV',
      image: require('../../../../media/images/platforms/nimo-logo-small.png'),
    },
  ];

  const title = isSignup ? $t('Sign Up') : $t('Log In');

  return (
    <div className={styles.pageContainer}>
      <div className={styles.container}>
        <h1 className={commonStyles.titleContainer} style={{ marginTop: 0 }}>
          {title}
        </h1>
        {isSignup ? (
          <Signup onSignupLinkClick={() => setIsSignup(false)} onSuccess={afterLogin} />
        ) : (
          <>
            {!isRelog && <p style={{ marginBottom: 20 }}>{$t('Log in with email/password')}</p>}
            {isRelog && (
              <h3 style={{ marginBottom: '16px' }}>
                {$t(
                  'Your login has expired. Please reauthenticate to continue using Streamlabs Desktop.',
                )}
              </h3>
            )}
            <div className={styles.streamlabsPlatformContainer}>
              <PlatformButton
                platform="streamlabs"
                loading={loading}
                disabled={loading || authInProgress}
                onClick={() => authPlatform('streamlabs', afterLogin)}
              >
                <Translate
                  message={$t('Log in with <span>%{platform}</span>', {
                    platform: 'Streamlabs ID',
                  })}
                >
                  <span slot="span" style={{ fontWeight: 'bold' }} />
                </Translate>
              </PlatformButton>
            </div>

            <div className={styles.thirdPartyPlatforms}>
              <p>{$t('Log in with a platform')}</p>

              <div className={styles.thirdPartyPlatformsContainer}>
                {platforms.map((platform: TPlatform) => (
                  <PlatformButton
                    platform={platform}
                    disabled={loading || authInProgress}
                    loading={loading}
                    onClick={() => authPlatform(platform, afterLogin)}
                    key={platform}
                  >
                    <Translate
                      message={$t('Log in with <span>%{platform}</span>', {
                        platform: platformLabels(platform),
                      })}
                    >
                      <span slot="span" />
                    </Translate>
                  </PlatformButton>
                ))}
              </div>
              <div className={styles.extraPlatformsContainer}>
                {shouldAddTrovo && (
                  <PlatformIconButton
                    platform={EPlatform.Trovo}
                    disabled={loading || authInProgress}
                    loading={loading}
                    onClick={() => authPlatform(EPlatform.Trovo, afterLogin)}
                    title={$t('Log in with %{platform}', {
                      platform: platformLabels(EPlatform.Trovo),
                    })}
                  />
                )}
                {extraPlatforms.map(platform => (
                  <PlatformIconButton
                    key={platform.value}
                    logo={platform.image}
                    disabled={loading || authInProgress}
                    loading={loading}
                    onClick={() => onSelectExtraPlatform(platform.value)}
                    title={$t('Log in with %{platform}', {
                      platform: platform.label,
                    })}
                  />
                ))}
              </div>
            </div>
            <div className={styles.signupLinkContainer}>
              <Translate message={$t("Don't have an account yet? <span>Sign up</span>")}>
                <a slot="span" onClick={() => setIsSignup(true)} />
              </Translate>
            </div>
          </>
        )}
      </div>
      <div className={styles.svgBackgrounds}>
        <SVGOvalLeftBackground />
        <SVGOvalRightBackground />
      </div>
    </div>
  );
}

const SVGOvalRightBackground = () => (
  <svg
    id="oval-right"
    width="692"
    height="524"
    viewBox="0 0 692 524"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M156.333 -77.6233C116.026 -196.226 142.587 -330.779 214.729 -416.705C286.872 -502.631 404.88 -539.961 522.904 -543.795C640.928 -547.629 759.072 -518.127 862.158 -451.659C965.244 -385.191 1053.09 -281.887 1093.81 -163.927C1134.63 -46.1289 1128.41 86.1639 1067.24 175.508C1006.34 264.821 890.687 310.864 772.152 315.502C653.515 320.301 532.101 283.535 417.766 213.68C303.613 143.955 196.641 40.9795 156.333 -77.6233Z"
      fill="#09161D"
    />
  </svg>
);

const SVGOvalLeftBackground = () => (
  <svg
    id="oval-left"
    width="669"
    height="620"
    viewBox="0 0 669 620"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M518.105 430.239C581.518 535.15 584.359 669.337 533.428 766.607C482.498 863.876 377.531 924.319 265.52 952.746C153.509 981.173 34.39 977.76 -78.092 935.854C-190.574 893.948 -296.219 813.634 -359.887 709.424C-423.619 605.389 -445.437 477.631 -405.705 379.395C-366.237 281.247 -265.345 212.971 -153.015 183.668C-40.6209 154.19 83.1482 163.859 207.092 206.643C330.837 249.341 454.693 325.327 518.105 430.239Z"
      fill="#09161D"
    />
  </svg>
);

type TExtraPlatform = 'nimotv' | 'dlive';

export class LoginModule {
  state = injectState({
    selectedExtraPlatform: undefined as TExtraPlatform | undefined,
  });

  get UserService() {
    return Services.UserService;
  }

  get UsageStatisticsService() {
    return Services.UsageStatisticsService;
  }

  get isRelog() {
    return this.UserService.state.isRelog;
  }

  get loading() {
    return this.UserService.state.authProcessState === EAuthProcessState.Loading;
  }

  get authInProgress() {
    return this.UserService.state.authProcessState === EAuthProcessState.InProgress;
  }

  get isPartialSLAuth() {
    return this.UserService.views.isPartialSLAuth;
  }

  async authPlatform(platform: TPlatform | 'streamlabs', onSuccess: () => void, merge = false) {
    this.UsageStatisticsService.recordAnalyticsEvent('PlatformLogin', platform);

    if (platform === 'streamlabs') {
      await this.UserService.startSLAuth();
      onSuccess();
      return;
    }

    const result = await this.UserService.startAuth(
      platform,
      ['youtube', 'twitch', 'twitter'].includes(platform) ? 'external' : 'internal',
      merge,
    );

    if (result === EPlatformCallResult.TwitchTwoFactor) {
      remote.dialog
        .showMessageBox({
          type: 'error',
          message: $t(
            'Twitch requires two factor authentication to be enabled on your account in order to stream to Twitch. ' +
              'Please enable two factor authentication and try again.',
          ),
          title: $t('Twitch Authentication Error'),
          buttons: [$t('Enable Two Factor Authentication'), $t('Dismiss')],
        })
        .then(({ response }) => {
          if (response === 0) {
            remote.shell.openExternal('https://twitch.tv/settings/security');
          }
        });
    } else {
      // Currently we do not have special handling for generic errors
      onSuccess();
    }
  }

  async finishSLAuth(primaryPlatform?: TPlatform) {
    const result = await this.UserService.finishSLAuth(primaryPlatform);

    if (result === EPlatformCallResult.TwitchScopeMissing) {
      await remote.dialog.showMessageBox(remote.getCurrentWindow(), {
        type: 'warning',
        message: $t(
          'Streamlabs requires additional permissions from your Twitch account. Please log in with Twitch to continue.',
        ),
        title: 'Twitch Error',
        buttons: [$t('Refresh Login')],
      });

      // Initiate a Twitch merge to get permissions
      await this.authPlatform('twitch', () => {}, true);
    }

    return result;
  }

  @mutation()
  setExtraPlatform(val: TExtraPlatform | undefined) {
    this.state.selectedExtraPlatform = val;
  }
}
