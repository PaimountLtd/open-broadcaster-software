import { readdir } from 'fs-extra';
import { test, useWebdriver } from '../helpers/webdriver';
import { sleep } from '../helpers/sleep';
import { startRecording, stopRecording } from '../helpers/modules/streaming';
import { FormMonkey } from '../helpers/form-monkey';
import {
  setOutputResolution,
  setTemporaryRecordingPath,
  showSettingsWindow,
} from '../helpers/modules/settings/settings';
import { clickButton, focusMain } from '../helpers/modules/core';
import { logIn } from '../helpers/webdriver/user';
import { toggleDualOutputMode } from '../helpers/modules/dual-output';

useWebdriver();

/**
 * Recording with one context active (horizontal)
 */
test('Recording', async t => {
  const tmpDir = await setTemporaryRecordingPath();

  // low resolution reduces CPU usage
  await setOutputResolution('100x100');

  const formats = ['flv', 'mp4', 'mov', 'mkv', 'ts', 'm3u8'];

  // Record 0.5s video in every format
  for (const format of formats) {
    await showSettingsWindow('Output', async () => {
      const form = new FormMonkey(t);
      await form.setInputValue(await form.getInputSelectorByTitle('Recording Format'), format);
      await clickButton('Done');
    });

    await focusMain();
    await startRecording();
    await sleep(1000);
    console.log('recording started');
    await stopRecording();

    // Wait to ensure that output setting are editable
    await sleep(500);
  }

  // Check that every file was created
  const files = await readdir(tmpDir);

  // M3U8 creates multiple TS files in addition to the catalog itself.
  t.true(files.length >= formats.length, `Files that were created:\n${files.join('\n')}`);
});

/**
 * Recording with two contexts active (horizontal and vertical)
 * should produce no different results than with one context
 */
test('Recording with two contexts active', async t => {
  await logIn(t);
  await toggleDualOutputMode();

  const tmpDir = await setTemporaryRecordingPath();

  // low resolution reduces CPU usage
  await setOutputResolution('100x100');

  const formats = ['flv', 'mp4', 'mov', 'mkv', 'ts', 'm3u8'];

  // Record 0.5s video in every format
  for (const format of formats) {
    await showSettingsWindow('Output', async () => {
      const form = new FormMonkey(t);
      await form.setInputValue(await form.getInputSelectorByTitle('Recording Format'), format);
      await clickButton('Done');
    });

    await focusMain();
    await startRecording();
    await sleep(1000);
    await stopRecording();

    // Wait to ensure that output setting are editable
    await sleep(1000);
  }

  // Check that every file was created
  const files = await readdir(tmpDir);

  // M3U8 creates multiple TS files in addition to the catalog itself.
  t.true(files.length >= formats.length, `Files that were created:\n${files.join('\n')}`);
});
