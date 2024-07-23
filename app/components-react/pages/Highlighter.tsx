import ClipsView from 'components-react/highlighter/ClipsView';
import SettingsView from 'components-react/highlighter/SettingsView';
import { useVuex } from 'components-react/hooks';
import React, { useState } from 'react';
import { IClip, IHighlighterData } from 'services/highlighter';
import { Services } from 'components-react/service-provider';
import { Button } from 'antd';

interface IClipsViewState {
  view: 'clips';
  id: string;
}
interface IStreamViewState {
  view: 'stream';
}

interface ISettingsViewState {
  view: 'settings';
}

type IViewState = IClipsViewState | IStreamViewState | ISettingsViewState;

export default function Highlighter() {
  const [viewState, setViewState] = useState<IViewState>({ view: 'settings' });

  const { HighlighterService, RecordingModeService } = Services;
  const v = useVuex(() => ({
    clips: HighlighterService.views.clips as IClip[],
    dismissedTutorial: HighlighterService.views.dismissedTutorial,
    error: HighlighterService.views.error,
    recordings: RecordingModeService.views.sortedRecordings,
  }));

  // TODO: Below is currently always true. Add the handle correctly
  // if (viewState.view !== 'settings' && !v.clips.length && !v.dismissedTutorial && !v.error || ) {
  //   setViewState({ view: 'settings' });
  // }

  // let streamMockdata: { id: string; videoUri: string }[] = [{ id: '123', videoUri: '234' }];
  let streamMockdata: { id: string; videoUri: string; highlighterData: any }[] = v.recordings.map(
    recording => ({
      id: recording.timestamp,
      videoUri: recording.filename,
      highlighterData: { start: 2, end: 4, type: 'lol' },
    }),
  );

  switch (viewState.view) {
    case 'settings':
      // TODO: Add show tutorial
      return (
        <>
          {devHeaderBar()}
          <SettingsView
            close={() => {
              HighlighterService.actions.dismissTutorial();
              // TODO
              // setShowTutorial(false);
            }}
          />
        </>
      );

      break;

    // case 'stream':
    //   return (
    //     <>
    //       {' '}
    //       {devHeaderBar()}{' '}
    //       <div>
    //         {' '}
    //         {streamMockdata.map(stream => (
    //           <Button
    //             key={stream.id}
    //             onClick={() =>
    //               setView({
    //                 view: 'clips',
    //                 id: '123',
    //                 recordingPath: stream.videoUri,
    //                 highlighterData: stream.highlighterData,
    //               })
    //             }
    //           >
    //             {stream.videoUri}
    //           </Button>
    //         ))}
    //       </div>
    //     </>
    //   );
    //   break;
    case 'clips':
      return (
        <>
          {devHeaderBar()}
          <ClipsView id={viewState.id} />
        </>
      );
      break;
    default:
      return <>DefaultView</>;
      break;
  }

  // Dev purposes
  function devHeaderBar() {
    return (
      <>
        <Button
          style={{ marginTop: '16px', marginRight: '8px' }}
          onClick={() => setView({ view: 'settings' })}
        >
          Settings
        </Button>
        <Button
          style={{ marginTop: '16px', marginRight: '8px' }}
          onClick={() => setView({ view: 'stream' })}
        >
          stream
        </Button>
        <Button
          style={{ marginTop: '16px', marginRight: '8px' }}
          onClick={() => setView({ view: 'clips', id: 'id' })}
        >
          clips
        </Button>

        <Button
          style={{ marginTop: '16px', marginRight: '8px' }}
          onClick={() => trimHighlightData()}
        >
          create clips
        </Button>
      </>
    );
  }

  function setView(view: IViewState) {
    setViewState(view);
  }

  async function trimHighlightData() {
    HighlighterService.actions.flow();
  }
}
