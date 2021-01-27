const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');
const path = require('path');

const { context } = github;

const buildId = context.runId;
const buildHash = context.sha;
const buildApp = `${context.repo.owner}/${context.repo.repo}`;
const buildBasePath = process.env.GITHUB_WORKSPACE;

core.info('Getting commit info:');
core.info(` - App name: ${buildApp}`);
core.info(` - Build version/hash: ${buildHash}`);
core.info(` - Build ID: ${buildId}`);

const branchRef = context.ref;
let branchName;

if (branchRef.startsWith('refs/heads/')) {
  branchName = branchRef.replace('refs/heads/', '');
} else {
  branchName = branchRef;
}

const isMainBranch = (branchName === 'master' || branchName === 'main');
const isTestingBranch = (branchName === 'testing');


//
// Set branch env variables
//
core.info('Evaluating branch:');

core.info(` - Branch name: ${branchName}`);
core.exportVariable('BN_BUILD_BRANCH_NAME', branchName);

if (isMainBranch) {
  core.info(' - Is main branch');
  core.exportVariable('BN_BUILD_IS_MAIN_BRANCH', '1');
}
if (isTestingBranch) {
  core.info(' - Is testing branch');
  core.exportVariable('BN_BUILD_IS_TESTING_BRANCH', '1');
}


//
// Set default Next variables
//
core.info('Preparing Next.JS .env file:');

const nextConfigPath = path.join(buildBasePath, './next.config.js');
if (fs.existsSync(nextConfigPath)) {
  core.info(' - Next.JS detected, adding variables to .env');

  fs.appendFileSync(
    path.join(buildBasePath, './.env'),
    `
NEXT_PUBLIC_APP_NAME=${buildApp}
NEXT_PUBLIC_APP_VERSION=${buildHash}
TZ=UTC
NODE_ENV=production
`
  );
} else {
  core.info(' - Next.JS not detected');
}


//
// Detect Vercel config
//
core.info('Detecting .vercel config:');
const vercelConfigPath = path.join(buildBasePath, './.vercel/project.json');
if (fs.existsSync(vercelConfigPath)) {
  core.info(' - Vercel config detected');

  let vercelEnvVar = null;
  if (isMainBranch) {
    vercelEnvVar = 'prod';
  } else if (isTestingBranch) {
    vercelEnvVar = 'testing';
  }

  if (vercelEnvVar) {
    core.info(` - Setting Vercel deploy to: ${vercelEnvVar}`);
    core.exportVariable('BN_DEPLOY_VERCEL', vercelEnvVar);
  }
} else {
  core.info(' - Vercel config not detected');
}


//
// Detect ClaudiaJS config
//
core.info('Detecting ClaudiaJS config:');
const claudiaTestingConfigPath = fs.existsSync(path.join(buildBasePath, './claudia_testing.json'));
const claudiaProdConfigPath = fs.existsSync(path.join(buildBasePath, './claudia_prod.json'));

if (isMainBranch && claudiaProdConfigPath) {
  core.info(' - Setting Claudia to prod deployment');
  core.exportVariable('BN_CLAUDIA_DEPLOYMENT', 'prod');
} else if (isTestingBranch && claudiaTestingConfigPath) {
  core.info(' - Setting Claudia to testing deployment');
  core.exportVariable('BN_CLAUDIA_DEPLOYMENT', 'testing');
} else {
  core.info(' - Claudia config not detected / not correct branch');
}


//
// Generate build.json
//
core.info('Generating build.json file:');
const fullPath = path.join(buildBasePath, './build.json');

const fileContent = JSON.stringify({
  'BNS-BD-ID': buildId,
  'BNS-BD-VERSION': buildHash,
  'BNS-BD-APP': buildApp,
});

fs.writeFile(fullPath, fileContent, function (error) {
  if (error) {
    core.setFailed(error.message);
  }
  core.info(` - Successfully written file ${fullPath} with content ${fileContent}`);
});
