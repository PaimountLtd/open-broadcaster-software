import {
  startApp,
  stopApp,
  test,
  useSpectron,
  focusChild,
  skipCheckingErrorsInLog
} from './helpers/spectron';

import { getClient } from './helpers/api-client';
const path = require('path');
import fse = require('fs-extra');
import fs = require('fs');
import os = require('os');
import { logIn } from './helpers/spectron/user';
import { SceneCollectionsService } from 'services/api/external-api/scene-collections';
import { ScenesService } from '../app/services/api/external-api/scenes';

useSpectron({ noSync: false });

test('Media backup', async t => {

  // sometimes this test causes a console error from Electron's code that is difficult to catch
  //
  // [error] Error: Object has been destroyed
  //       at C:\agent\_work\1\s\node_modules\electron\dist\resources\electron.asar\browser\rpc-server.js:392:52
  //
  // just disable error checking for now
  skipCheckingErrorsInLog();

  // copy images to the temporary folder
  const imagesDir = path.resolve(__dirname, '..', '..', 'test', 'data', 'sources-files', 'images');
  const tmpDir = fs.mkdtempSync(os.tmpdir());
  fse.copySync(imagesDir, tmpDir);

  // media sync works only in log-in state
  await logIn(t);

  const api = await getClient();
  const collectionsService = api.getResource<SceneCollectionsService>('SceneCollectionsService');

  // create an new empty collection
  const collection = await collectionsService.create({ name: 'Test collection' });

  try {
    const scene = api.getResource<ScenesService>('ScenesService').activeScene;
    const image1Path = path.resolve(tmpDir, 'moon.png');
    const image2Path = path.resolve(tmpDir, 'sun.png');

    // simply create the first image
    const item1 = scene.createAndAddSource('image', 'image_source', {
      file: image1Path,
    });

    // create the second image by duplicating the first image and changing the file path
    const item2 = scene.addSource(item1.getSource().duplicate().sourceId);
    item2.getSource().updateSettings({
      file: image2Path,
    });

    // media-backup sync should be started
    // wait for the sync-succeed icon
    await t.context.app.client.click('.metrics-icon');
    await focusChild(t);
    await t.context.app.client.waitForVisible('.icon-cloud-backup-2');

    // restart app and delete local images
    await stopApp(t, false);
    fse.removeSync(tmpDir);
    await startApp(t, true);

    // images should be downloaded from the media-backup server
    const image1DownloadedPath = item1.getSource().getSettings().file;
    const image2DownloadedPath = item2.getSource().getSettings().file;
    t.truthy(image1DownloadedPath);
    t.truthy(image2DownloadedPath);
    t.not(image1Path, image1DownloadedPath);
    t.not(image2Path, image2DownloadedPath);
  } catch (e) {
    await collectionsService.delete(collection.id);
    throw e;
  }
});
