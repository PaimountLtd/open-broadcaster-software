import { readdir } from 'fs-extra';
import { focusChild, focusMain, test, useSpectron } from '../helpers/spectron';
import { setFormDropdown } from '../helpers/spectron/forms';
import { sleep } from '../helpers/sleep';
import { startRecording, stopRecording } from '../helpers/spectron/streaming';
import { setOutputResolution, setTemporaryRecordingPath } from '../helpers/spectron/output';

useSpectron();

test('Recording', async t => {
  const { app } = t.context;
  const tmpDir = await setTemporaryRecordingPath(t);

  // low resolution reduces CPU usage
  await setOutputResolution(t, '100x100');

  const formats = ['flv', 'mp4', 'mov', 'mkv', 'ts', 'm3u8'];

  // Record 2s video in every format
  for (const format of formats) {
    await focusMain(t);
    await app.client.click('.side-nav .icon-settings');

    await focusChild(t);
    await app.client.click('li=Output');
    await setFormDropdown(t, 'Recording Format', format);
    await app.client.click('button=Done');
    await focusMain(t);

    await startRecording(t);
    await sleep(2000);
    await stopRecording(t);

    // Wait to ensure that output setting are editable
    await sleep(2000);
  }

  // Check that every file was created
  const files = await readdir(tmpDir);

  // M3U8 creates multiple TS files in addition to the catalog itself.
  t.true(files.length >= formats.length, `Files that were created:\n${files.join('\n')}`);
});
