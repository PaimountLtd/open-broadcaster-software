import { logIn } from '../../helpers/modules/user';
import { skipCheckingErrorsInLog, test, useSpectron } from '../../helpers/spectron';
import {
  chatIsVisible,
  clickGoLive,
  goLive,
  prepareToGoLive,
  stopStream,
} from '../../helpers/modules/streaming';

import { isDisplayed } from '../../helpers/modules/core';

useSpectron();

test('Streaming to Youtube', async t => {
  await logIn('youtube', { multistream: false });
  t.false(await chatIsVisible(), 'Chat should not be visible for YT before stream starts');

  await goLive({
    title: 'SLOBS Test Stream',
    description: 'SLOBS Test Stream Description',
  });

  t.true(await chatIsVisible(), 'Chat should be visible');
  await stopStream();
});

test('Start stream twice to the same YT event', async t => {
  await logIn('youtube', { multistream: false });

  // create event via scheduling form
  const now = Date.now();
  await goLive({
    title: `Youtube Test Stream ${now}`,
    description: 'SLOBS Test Stream Description',
    enableAutoStop: false,
  });
  await stopStream();

  await goLive({
    broadcastId: `Youtube Test Stream ${now}`,
    enableAutoStop: true,
  });
  await stopStream();
  t.pass();
});

test('Youtube streaming is disabled', async t => {
  skipCheckingErrorsInLog();
  await logIn('youtube', { streamingIsDisabled: true, notStreamable: true });
  t.true(
    await isDisplayed('span=YouTube account not enabled for live streaming'),
    'The streaming-disabled message should be visible',
  );
  await prepareToGoLive();
  await clickGoLive();
  t.true(
    await isDisplayed('button=Enable Live Streaming'),
    'The enable livestreaming button should be visible',
  );
});
