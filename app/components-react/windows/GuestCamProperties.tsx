import { Alert, Button, Modal, Tabs, Tooltip } from 'antd';
import { useVuex } from 'components-react/hooks';
import { Services } from 'components-react/service-provider';
import Display from 'components-react/shared/Display';
import { ListInput, SliderInput, TextInput } from 'components-react/shared/inputs';
import Form from 'components-react/shared/inputs/Form';
import { ModalLayout } from 'components-react/shared/ModalLayout';
import React, { useMemo, useState } from 'react';
import { EDeviceType } from 'services/hardware';
import { $t } from 'services/i18n';
import * as remote from '@electron/remote';
import { Spinner } from 'components-react/pages/Loader';
import { byOS, OS } from 'util/operating-systems';
import { TSourceType } from 'services/sources';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { EDismissable } from 'services/dismissables';

export default function GuestCamProperties() {
  const {
    GuestCamService,
    SourcesService,
    WindowsService,
    EditorCommandsService,
    DismissablesService,
  } = Services;
  const audioSourceType = byOS({
    [OS.Windows]: 'wasapi_input_capture',
    [OS.Mac]: 'coreaudio_input_capture',
  });
  const videoSourceType = byOS({ [OS.Windows]: 'dshow_input', [OS.Mac]: 'av_capture_input' });
  const {
    produceOk,
    visible,
    videoSourceId,
    audioSourceId,
    videoSources,
    audioSources,
    videoSourceExists,
    audioSourceExists,
    inviteUrl,
    source,
    guestInfo,
    volume,
    showFirstTimeModal,
  } = useVuex(() => ({
    produceOk: GuestCamService.state.produceOk,
    visible: GuestCamService.views.guestVisible,
    videoSourceId: GuestCamService.views.videoSourceId,
    videoSources: SourcesService.views.getSourcesByType(videoSourceType as TSourceType).map(s => ({
      label: s.name,
      value: s.sourceId,
    })),
    videoSourceExists: !!GuestCamService.views.videoSource,
    audioSourceId: GuestCamService.views.audioSourceId,
    audioSources: SourcesService.views.getSourcesByType(audioSourceType as TSourceType).map(s => ({
      label: s.name,
      value: s.sourceId,
    })),
    audioSourceExists: !!GuestCamService.views.audioSource,
    inviteUrl: GuestCamService.views.inviteUrl,
    source: GuestCamService.views.source,
    guestInfo: GuestCamService.state.guestInfo,
    volume: GuestCamService.views.deflection,
    showFirstTimeModal: DismissablesService.views.shouldShow(EDismissable.GuestCamFirstTimeModal),
  }));
  const [regeneratingLink, setRegeneratingLink] = useState(false);

  async function regenerateLink() {
    setRegeneratingLink(true);
    await GuestCamService.actions.return
      .ensureInviteLink(true)
      .finally(() => setRegeneratingLink(false));
  }

  function setDeflection(val: number) {
    if (!source) return;

    EditorCommandsService.actions.executeCommand('SetDeflectionCommand', source.sourceId, val);
  }

  return (
    <ModalLayout scrollable>
      <Tabs destroyInactiveTabPane={true}>
        <Tabs.TabPane tab={$t('Guest Settings')} key="guest-settings">
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              height: 260,
              background: 'var(--section-alt)',
              borderRadius: 8,
            }}
          >
            <div style={{ flexGrow: 1, padding: 20 }}>
              <h3>{$t('Source: %{sourceName}', { sourceName: source?.name })}</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <Button
                  onClick={() => GuestCamService.actions.setVisibility(!visible)}
                  disabled={!guestInfo}
                  style={{ width: '45%' }}
                  type={!!guestInfo && !visible ? 'primary' : 'default'}
                >
                  {!!guestInfo && visible ? $t('Hide on Stream') : $t('Show on Stream')}
                </Button>
                <button
                  className="button button--soft-warning"
                  style={{ width: '45%' }}
                  disabled={!guestInfo}
                  onClick={() => GuestCamService.actions.disconnectGuest()}
                >
                  {$t('Disconnect')}
                </button>
              </div>
              <Form layout="inline">
                <SliderInput
                  label={$t('Volume')}
                  value={volume}
                  onChange={setDeflection}
                  min={0}
                  max={1}
                  debounce={500}
                  step={0.01}
                  tipFormatter={v => `${(v * 100).toFixed(0)}%`}
                  style={{ width: '100%', margin: '10px 0' }}
                />
                <TextInput
                  readOnly
                  value={inviteUrl}
                  label={$t('Invite URL')}
                  style={{ width: '100%', margin: '10px 0 20px' }}
                  addonAfter={
                    <Tooltip title={$t('Copied!')} trigger="click">
                      <Button onClick={() => remote.clipboard.writeText(inviteUrl)}>
                        {$t('Copy')}
                      </Button>
                    </Tooltip>
                  }
                />
              </Form>
              <Button disabled={regeneratingLink} onClick={regenerateLink}>
                {$t('Generate a new link')}
                {regeneratingLink && (
                  <i className="fa fa-spinner fa-pulse" style={{ marginLeft: 8 }} />
                )}
              </Button>
            </div>
            <div style={{ width: 400, background: 'var(--section)', borderRadius: '0 8px 8px 0' }}>
              {/* Weird double div is to avoid display blocking border radius */}
              <div style={{ margin: '10px 0', height: 'calc(100% - 20px)' }}>
                {!!guestInfo && produceOk && <Display sourceId={source?.sourceId} />}
                {!guestInfo && (
                  <div
                    style={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      padding: '50px 0',
                    }}
                  >
                    <Spinner />
                    <div style={{ textAlign: 'center' }}>{$t('Waiting for guest to join')}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Tabs.TabPane>
        <Tabs.TabPane tab={$t('Global Settings')} key="global-settings">
          <Form>
            <h2>
              {$t(
                'You will need to select a microphone and webcam source in your current scene collection that will be sent to your guests for them to see and hear you.',
              )}
            </h2>
            <ListInput
              label={$t('Webcam Source')}
              options={videoSources}
              value={videoSourceId}
              onChange={s => GuestCamService.actions.setVideoSource(s)}
              allowClear={true}
            />
            <ListInput
              label={$t('Microphone Source')}
              options={audioSources}
              value={audioSourceId}
              onChange={s => GuestCamService.actions.setAudioSource(s)}
              allowClear={true}
            />
          </Form>
          {(!videoSourceExists || !audioSourceExists) && (
            <Alert
              type="error"
              showIcon={true}
              closable={false}
              message={
                <div style={{ color: 'var(--paragraph)' }}>
                  {!videoSourceExists && (
                    <div>
                      {$t('No webcam source is selected. Your guest will not be able to see you.')}
                    </div>
                  )}
                  {!audioSourceExists && (
                    <div>
                      {$t(
                        'No microphone source is selected. Your guest will not be able to hear you.',
                      )}
                    </div>
                  )}
                </div>
              }
            />
          )}
        </Tabs.TabPane>
      </Tabs>
      <Modal
        visible={!produceOk}
        getContainer={false}
        closable={false}
        okText={$t('Start Collab Cam')}
        onOk={() => {
          GuestCamService.actions.setProduceOk();
          DismissablesService.actions.dismiss(EDismissable.GuestCamFirstTimeModal);
        }}
        onCancel={() => WindowsService.actions.closeChildWindow()}
      >
        {showFirstTimeModal ? <FirstTimeModalContent /> : <EveryTimeModalContent />}
      </Modal>
    </ModalLayout>
  );
}

function EveryTimeModalContent() {
  return (
    <h2 style={{ textAlign: 'center' }}>
      {$t('Collab Cam is not yet sending your video and audio to guests. Start Collab Cam?')}
    </h2>
  );
}

function FirstTimeModalContent() {
  return (
    <>
      <h2>{$t('Welcome to Collab Cam')}</h2>
      <h3>{$t('Step 1')}</h3>
      <p>
        {$t(
          "Copy and share a link with your guest. When they join, they'll be able to see and hear you.",
        )}
      </p>
      <h3>{$t('Step 2')}</h3>
      <p>
        {$t(
          "Verify their identity in the preview area. When ready, add them to your stream by clicking 'Show on Stream'.",
        )}
      </p>
      <h3>{$t('Step 3')}</h3>
      <p>
        {$t(
          'Enjoy your stream! Adjust their volume, create new links, and change your mic and camera from the properties window.',
        )}
      </p>
      <Alert
        message={
          <div style={{ color: 'var(--info)' }}>
            <ExclamationCircleOutlined style={{ color: 'var(--info)', marginRight: 8 }} />
            {$t(
              "Don't share your invite link with anyone you don't want on your stream. You can invalidate an old link by generating a new one. Do not show this window on stream.",
            )}
          </div>
        }
        type="info"
        closable={false}
        showIcon={false}
        banner
      />
    </>
  );
}
