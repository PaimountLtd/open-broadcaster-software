const sh = require('shelljs');
const colors = require('colors/safe');
const fs = require('fs');
const os = require('os');
const path = require('path');
const stream = require('stream');

const node_modules = path.join(process.cwd(), 'node_modules');

const fetch = require('node-fetch');

function log_info(msg) {
    sh.echo(colors.magenta(msg));
  }
  
function log_error(msg) {
    sh.echo(colors.red(`ERROR: ${msg}`));
}

function executeCmd(cmd, options) {
  // Default is to exit on failure
  if (options.exit == null) options.exit = true;

  const result = options.silent ? sh.exec(cmd, { silent: true }) : sh.exec(cmd);

  if (result.code !== 0) {
    error(`Command Failed >>> ${cmd}`);
    if (options.exit) {
      sh.exit(1);
    } else {
      throw new Error(`Failed to execute command: ${cmd}`);
    }
  }

  return result.stdout;
}

function downloadFile(srcUrl, dstPath) {
  const tmpPath = `${dstPath}.tmp`;
  return new Promise((resolve, reject) => {
    fetch(srcUrl)
      .then(response => {
        if (response.ok) return response;
        log_error(`Got ${response.status} response from ${srcUrl}`);
        return Promise.reject(response);
      })
      .then(({ body }) => {
        const fileStream = fs.createWriteStream(tmpPath);
        stream.pipeline(body, fileStream, e => {
          if (e) {
            log_error(`Error downloading ${srcUrl}`, e);
            reject(e);
          } else {
            fs.rename(tmpPath, dstPath, e => {
              if (e) {
                reject(e);
                return;
              }
              log_info(`Successfully downloaded ${srcUrl}`);
              resolve();
            });
          }
        });
      })
      .catch(e => reject(e));
  });
}

async function runScript() {
  colors.blue('----Streamlabs OBS native dependecies installation----');

  try {
    const jsonData = fs.readFileSync('./scripts/repositories.json')
    const root = JSON.parse(jsonData.toString());
    const dependecies = root.root;
    let os = '';

    if (process.platform === 'win32')
      os = 'win64';
    else if (process.platform === 'darwin')
      os = 'osx';
    else
      throw 'Platform not supported.';

    sh.cd(node_modules);

    const promises = dependecies.filter(dependency => dependency[os])
      .map(async dependency => {
        executeCmd('rm -rf ' + path.join(node_modules, dependency['name']), { silent: false });

        let fileName = dependency['archive'];
        fileName = fileName.replace('[VERSION]', dependency['version']);
        fileName = fileName.replace('[OS]', os);
        
        const url = dependency['url'] + fileName;
        const filePath = path.join(process.cwd(), fileName);

        log_info ('Downloading ' + fileName);
        await downloadFile(url, filePath);
        log_info ('Installing ' + fileName);
        executeCmd('tar -xzvf ' + fileName, { silent: true });
        sh.rm(fileName);
      });
      await Promise.all(promises);

      if (process.platform === 'win32') {
        sh.cd('../scripts');
        executeCmd('facemask-plugin-move.bat', { silent: false });
      }
  } catch (error) {
    log_error('An error occured preventing the script from installing successfully all required native dependencies.')
    log_error(error);
    sh.exit(1);
  }
}

runScript().then(() => {
  sh.exit(0);
});