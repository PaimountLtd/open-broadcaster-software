const aws = require('aws-sdk');

function validateArgs(args) {
  let argsValid = true;

  const argRequired = (key, cb) => {
    const value = args[key];
    if (!value) {
      console.log(`${key} required`);
      argsValid = false;
      return;
    }

    if (cb && typeof (cb) === 'function') {
      cb(args[key]);
    }
  };

  if (!process.env['AWS_ACCESS_KEY_ID']) argRequired('access-key');
  if (!process.env['AWS_SECRET_ACCESS_KEY']) argRequired('secret-access-key');
  argRequired('version');

  argRequired('chance', (value) => {
    if (value >= 1 && value <= 100)
      return;

    console.log(`Chance value ${chance} expected to be a value from 1 to 100`);
    argsValid = false;
  });

  return argsValid;
}

async function main() {
  const args = require('minimist')(process.argv.splice(2));

  if (!validateArgs(args))
    return -1;

  const bucket = args['s3-bucket'];
  const version = args['version'];
  const chance = args['chance'];

  let s3Options;

  if (args['access-key'] && args['secret-access-key']) {
    const awsCredentials =
        new aws.Credentials(args['access-key'], args['secret-access-key']);

    s3Options = { credentials: awsCredentials };
  }

  const s3Client = new aws.S3(s3Options);

  const chanceFileParams = {
    Bucket : bucket,
    Key : `${version}.chance`,
    ACL : 'public-read',
    Body : JSON.stringify({chance})
  };

  await s3Client.upload(chanceFileParams).promise();
  return 0;
}

main().then((code) => {
  if (!code) code = 0;

  process.exit(code);
}).catch((error) => {
  console.log(error);
  process.exit(-256);
});