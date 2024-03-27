import { test, useWebdriver } from '../../helpers/webdriver';
import { logIn } from '../../helpers/modules/user';
import {
  clickGoLive,
  prepareToGoLive,
  waitForSettingsWindowLoaded,
  submit,
  waitForStreamStart,
  stopStream,
} from '../../helpers/modules/streaming';
import { addDummyAccount, releaseUserInPool } from '../../helpers/webdriver/user';
import { fillForm, readFields } from '../../helpers/modules/forms';
import { waitForDisplayed } from '../../helpers/modules/core';

useWebdriver();

test('Streaming to Instagram', async t => {
  const user = await logIn('twitch', { multistream: true });

  // test approved status
  const dummy = await addDummyAccount('instagram');

  await prepareToGoLive();
  await clickGoLive();
  await waitForSettingsWindowLoaded();
  await fillForm({
    instagram: true,
  });
  await waitForSettingsWindowLoaded();

  await fillForm({
    title: 'Test stream',
    twitchGame: 'Fortnite',
    streamUrl: dummy.serverUrl,
    streamKey: dummy.streamKey,
  });
  await submit();
  await waitForDisplayed('span=Update settings for Instagram');
  await waitForStreamStart();
  await stopStream();

  await releaseUserInPool(user);
  t.pass();
});
