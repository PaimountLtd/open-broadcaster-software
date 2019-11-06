const base = {
  appId: 'com.streamlabs.slobs',
  productName: 'Streamlabs OBS',
  icon: 'media/images/icon.ico',
  files: [
    'bundles',
    '!bundles/*.js.map',
    'node_modules',
    'vendor',
    'app/i18n',
    'updater/build/bootstrap.js',
    'index.html',
    'main.js',
    'obs-api'
  ],
  extraFiles: [
    'LICENSE',
    'AGREEMENT'
  ],
  nsis: {
    license: 'AGREEMENT',
    oneClick: false,
    perMachine: true,
    allowToChangeInstallationDirectory: true,
    include: 'installer.nsh'
  },
  publish: {
    provider: 'generic',
    url: 'https://slobs-cdn.streamlabs.com'
  },
  win: {},
  extraMetadata: {
    env: 'production'
  }
};

if (!process.env.SLOBS_NO_SIGN) base.win.certificateSubjectName = 'Streamlabs (General Workings, Inc.)';

module.exports = base;
