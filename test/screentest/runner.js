require('dotenv').config();
const rimraf = require('rimraf');
const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');
const uuid = require('uuid');
const recursiveReadDir = require('recursive-readdir');
const { GithubClient } = require('../../scripts/github-client');
const { exec, checkoutBranch, getCommitSHA } = require('../helpers/repo');
const {
  AWS_ACCESS_KEY,
  AWS_SECRET_KEY,
  AWS_BUCKET,
  STREAMLABS_BOT_ID,
  STREAMLABS_BOT_KEY,
  BUILD_REPOSITORY_NAME,
  BUILD_BUILD_ID,
} = process.env;
const CONFIG = require('./config.json');
const commitSHA = getCommitSHA();
const args = process.argv.slice(2);

(async function main() {

  // prepare the dist dir
  rimraf.sync(CONFIG.dist);
  fs.mkdirSync(CONFIG.dist, { recursive: true });

  // make screenshots for each branch
  const branches = [
    'current',
    CONFIG.baseBranch
  ];
  for (const branchName of branches) {
    checkoutBranch(branchName, CONFIG);
    exec(`yarn test-flaky ${CONFIG.compiledTestsDist}/screentest/tests/**/*.js ${args.join(' ')}`);
  }
  // return to the current branch
  checkoutBranch('current', CONFIG);

  // compile the test folder
  exec(`tsc -p test`);

  // compare screenshots
  exec(`node ${CONFIG.compiledTestsDist}/screentest/comparator.js ${branches[0]} ${branches[1]}`);

  // send the status to the GitHub check and upload screenshots
  await updateCheck();
})();


async function updateCheck() {

  if (!STREAMLABS_BOT_ID || !STREAMLABS_BOT_KEY) {
    console.info('STREAMLABS_BOT_ID or STREAMLABS_BOT_KEY is not set. Skipping GitCheck status update');
    return;
  }

  // try to read test results from the file
  let testResults = null;
  try {
    testResults = require('../../test-dist/screentest/state.json');
  } catch (e) {
    console.error('No results found for screentest');
  }

  // create a conclusion
  let conclusion = '';
  let title = '';
  if (!testResults) {
    conclusion = 'failure';
    title = 'Tests failed';
  } else if (testResults.changedScreens) {
    conclusion = 'action_required';
    title = `Changes are detected in ${testResults.changedScreens} screenshots`;
  } else {
    conclusion = 'success';
    title = `${testResults.totalScreens} screenshots have been checked.` + `\n` +
            `${testResults.newScreens} new screenshots have been found`;
  }

  // upload screenshots if any changes present
  let screenshotsUrl = '';
  if (conclusion === 'action_required' || testResults.newScreens > 1) {
    screenshotsUrl = await uploadScreenshots();
  }

  console.info('Updating the GithubCheck', conclusion, title);

  // AzurePipelines doesn't support multiline variables.
  // All new-line characters are replaced with `;`
  const botKey = STREAMLABS_BOT_KEY.replace(/;/g, '\n');

  const [owner, repo] = BUILD_REPOSITORY_NAME.split('/');
  const github = new GithubClient(STREAMLABS_BOT_ID, botKey, owner, repo);

  try {
    await github.login();
    await github.postCheck({
      name: 'Screenshots',
      head_sha: commitSHA,
      conclusion: 'success',
      completed_at: new Date().toISOString(),
      details_url: screenshotsUrl || 'https://github.com/stream-labs/streamlabs-obs',
      output: {
        title: title,
        summary: ''
      }
    });
  } catch (e) {
    console.error('Unable to update GithubCheck status');
    console.error(e);
  }

}


async function uploadScreenshots() {
  if (!AWS_ACCESS_KEY || !AWS_SECRET_KEY || !AWS_BUCKET) {
    console.error('Setup AWS_ACCESS_KEY AWS_SECRET_KEY AWS_BUCKET to upload screenshots');
    return;
  }

  console.info(`Uploading screenshots to the s3 bucket`);
  const Bucket = AWS_BUCKET;
  const awsCredentials = new AWS.Credentials(AWS_ACCESS_KEY, AWS_SECRET_KEY);
  const s3Options = {credentials : awsCredentials};
  const s3Client = new AWS.S3(s3Options);
  const bucketDir = BUILD_BUILD_ID || uuid();

  try {
    const files = await recursiveReadDir(CONFIG.dist);
    for (const filePath of files) {
      console.info(`uploading ${filePath}`);
      const relativePath = path.relative(CONFIG.dist, filePath).replace('\\', '/');
      const stream = fs.createReadStream(filePath);
      const params = {
        Bucket,
        Key : `${bucketDir}/${relativePath}`,
        ContentType: 'text/html',
        ACL : 'public-read',
        Body : stream
      };
      await s3Client.upload(params).promise();
    }
    const url = `http://${Bucket}.s3.amazonaws.com/${bucketDir}/preview.html`;
    console.info('Screenshots uploaded', url);
    return url;
  } catch (e) {
    console.error('Failed to upload screenshots');
    console.error(e);
  }

}
