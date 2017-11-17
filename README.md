# Streamlabs OBS

[![Build status](https://ci.appveyor.com/api/projects/status/xxn8immagev9o1fd/branch/staging?svg=true)](https://ci.appveyor.com/project/Streamlabs/streamlabs-obs)

Electron client for the Streamlabs OBS streaming software.

This application currently only supports 64-bit Windows.

## Dependencies

### Node.js

Node is required for installing npm packages and for running
various scripts.  We recommend the current LTS release, 8.9.1:

https://nodejs.org

### Yarn

In order to ensure you are using the correct version of each
node module, you should use the yarn package manager.
Installation instructions can be found here:

https://yarnpkg.com/en/docs/install

### Visual C++ Compiler

Yarn will install and compile a number of native extensions from
source.  For yarn to do this, it needs a Visual C++ compiler.  The
most reliable way to get this is to install:

Visual Studio Community 2015 with Update 3

Make sure you do a custom installation and select Visual C++ from
the languages section.

### CMake

Some of our native addons require CMake for compilation.  You can
download it here:

https://cmake.org/download/

### Python 2.7

Node-gyp requires python 2.7 available in your path to install some
native addons.  You can download it here:

https://www.python.org/

## Installation

First, make sure you have initialized git submodules:

```
git submodule update --init --recursive
```

Install all node modules via yarn:

```
yarn install
```

Install the current release of node-obs:

```
yarn install-node-obs
```

If you would prefer to compile this yourself, you can find instructions here:
https://github.com/stream-labs/node-obs

Then, compile assets with webpack:

```
yarn compile
```

## Starting

If you are using Visual Studio Code, you can start the app
using the built in debugger (default F5).

Otherwise, you can run the app with:

```
yarn start
```

## Environment Variables

These variables can be used in development to force certain behavior.

`SLOBS_FORCE_AUTO_UPDATE`: Force the auto-updater to run in development. Normally
this would only run in production.

`SLOBS_CACHE_DIR`: Force a different location for the user data cache directory.

`SLOBS_DISABLE_MAIN_LOGGING`: Disable javascript logging in the main process.

## Packaging / Distributing

Currently only Windows x64 packaging is supported.

### Prerequesites

The packager will use whatever version of node-obs you have
checked out in the slobs directory (at `./node-obs`).  You
should make sure that node-obs is compiled correctly with 32-bit
and 64-bit plugins, and works properly with the currently checked
out version of `streamlabs-obs`.  If you're releasing, that should
probably be the `master` branch.  You should probably try running
the app from your dev environment to make sure everything is
working before you start the release process.

### Packaging and Deploying

Make sure the app is not running in your dev environment
before you start the packaging process.

You can package the app by running:

```
yarn package
```

This will package a distributable installer `.exe` to the `dist/`
directory.  There is also an unpacked version in `dist/win-unpacked`.

If you plan on deploying the app to our update server, you should make
sure that the packager can sign the executables.
This will only happen if you have `CSC_LINK` and `CSC_KEY_PASSWORD`
set in your environment.  Only authorized team members have access to these.

If you want to deploy the packaged installer such that it will be
picked up by the auto-updater, you can run:

```
yarn deploy
```

You should thoroughly test the packaged app before running this, since
all users will be forced to upgrade to this verion the next time they
start the app.

In order for this to work, you will need to have `AWS_ACCESS_KEY_ID`
and `AWS_SECRET_ACCESS_KEY` set in your environment. These values
are secret. Only authorized team members have deploy access.

### Deploy Checklist

This is a checklist to run through every time you deploy.

- [ ] Merge `staging` into `master` - DO NOT "Squash & Merge", just do a regular merge
- [ ] Check out `master`
- [ ] If submodules are out of date `git submodule update --init --recursive`
- [ ] Remove node modules `rm -rf node_modules`
- [ ] Install fresh packages `yarn install`
- [ ] Install node-obs with latest plugins `yarn install-node-obs`
- [ ] Compile assets `yarn compile`
- [ ] Run the test suite `yarn test`
- [ ] Change the version in `package.json`
- [ ] Commit and push
- [ ] Tag the repo `git tag 'v0.0.11'` and `git push --tags`
- [ ] Package the app `yarn package`
- [ ] Run the packaged version in `dist/win-unpacked` and make sure it runs
- [ ] Deploy the new version `yarn deploy`
- [ ] Merge master back into staging
