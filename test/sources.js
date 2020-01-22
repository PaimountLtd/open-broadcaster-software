import { useSpectron, focusMain, focusChild, test } from './helpers/spectron/index';
import {
  addSource,
  clickRemoveSource,
  clickSourceProperties,
  selectSource,
  openRenameWindow,
  sourceIsExisting, waitForSourceExist
} from './helpers/spectron/sources';
import { sleep } from './helpers/sleep';

useSpectron();

const sourceTypes = [
  // 'Video Capture Device',
  // 'Audio Output Capture',
  // 'Audio Input Capture',
  // 'Game Capture',
  // 'Window Capture',
  // 'Display Capture',
  // 'Image',
  // 'Image Slide Show',
  // 'Media Source',
  // 'Text (GDI+)',
  // 'Color Source',
  'Browser Source'
];


test('Adding and removing some sources', async t => {
  const app = t.context.app;

  for (const sourceType of sourceTypes) {
    const sourceName = `Example ${sourceType}`;

    await addSource(t, sourceType, sourceName);
    await focusMain(t);

    t.true(await sourceIsExisting(t, sourceName));

    await selectSource(t, sourceName);
    await clickRemoveSource(t);
    await waitForSourceExist(t, sourceName, true);
  }
  t.pass();
});

test('Viewing source properties', async t => {
  const app = t.context.app;
  const sourceName = 'Cool Color Source';

  await addSource(t, 'Color Source', sourceName);

  await focusMain(t);
  await selectSource(t, sourceName);
  await clickSourceProperties(t);

  await focusChild(t);
  t.true(await app.client.isExisting('label=Color'));
});


test('Rename source', async t => {
  const app = t.context.app;
  const sourceName = 'MyColorSource1';
  const newSourceName = 'MyColorSource2';

  await addSource(t, 'Color Source', sourceName);

  await openRenameWindow(t, sourceName);
  await app.client.setValue('input', newSourceName);
  await app.client.click('button=Done');


  await focusMain(t);
  t.true(await sourceIsExisting(t, newSourceName));
});
