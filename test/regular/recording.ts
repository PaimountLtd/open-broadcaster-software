import { readdir } from 'fs-extra';
import { focusChild, focusMain, test, useSpectron } from '../helpers/spectron';
import { sleep } from '../helpers/sleep';
import { startRecording, stopRecording } from '../helpers/modules/streaming';
import { FormMonkey } from '../helpers/form-monkey';
import {
  setOutputResolution,
  setTemporaryRecordingPath,
} from '../helpers/modules/settings/settings';

useSpectron();

test('Recording', async t => {
  const { app } = t.context;
  const tmpDir = await setTemporaryRecordingPath();

  // low resolution reduces CPU usage
  await setOutputResolution('100x100');

  const formats = ['flv', 'mp4', 'mov', 'mkv', 'ts', 'm3u8'];

  // Record 2s video in every format
  for (const format of formats) {
    await focusMain(t);
    await (await app.client.$('.side-nav .icon-settings')).click();

    await focusChild(t);
    await (await app.client.$('li=Output')).click();
    const form = new FormMonkey(t);
    await form.setInputValue(await form.getInputSelectorByTitle('Recording Format'), format);
    await (await app.client.$('button=Done')).click();
    await focusMain(t);

    await startRecording();
    await sleep(2000);
    await stopRecording();

    // Wait to ensure that output setting are editable
    await sleep(2000);
  }

  // Check that every file was created
  const files = await readdir(tmpDir);

  // M3U8 creates multiple TS files in addition to the catalog itself.
  t.true(files.length >= formats.length, `Files that were created:\n${files.join('\n')}`);
});
