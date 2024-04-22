import { test, useWebdriver } from '../../helpers/webdriver';
import { logIn } from '../../helpers/modules/user';
import {
  clickGoLive,
  prepareToGoLive,
  stopStream,
  submit,
  waitForSettingsWindowLoaded,
  waitForStreamStart,
} from '../../helpers/modules/streaming';
import { addDummyAccount, releaseUserInPool } from '../../helpers/webdriver/user';
import { fillForm } from '../../helpers/modules/forms';
import { waitForDisplayed } from '../../helpers/modules/core';

useWebdriver();

test('Streaming to X', async t => {
  const user = await logIn('twitch', { multistream: true });
  await addDummyAccount('twitter');

  await prepareToGoLive();
  await clickGoLive();
  await waitForSettingsWindowLoaded();
  await fillForm({
    twitter: true,
  });
  await waitForSettingsWindowLoaded();

  await fillForm({
    title: 'Test stream',
    twitchGame: 'Fortnite',
  });
  await submit();
  await waitForDisplayed('span=Update settings for X (Twitter)');
  await waitForStreamStart();
  await stopStream();

  await releaseUserInPool(user);
  t.pass();
});
