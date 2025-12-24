// Script to create GitHub repo and push code
// Reference: connection:conn_github_01KCM63NJ1HZFJY576NMXEXNBM

import { Octokit } from '@octokit/rest';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('GitHub not connected');
  }
  return accessToken;
}

async function pushToGitHub() {
  console.log('Getting GitHub access token...');
  const accessToken = await getAccessToken();
  const octokit = new Octokit({ auth: accessToken });

  // Get authenticated user
  const { data: user } = await octokit.users.getAuthenticated();
  console.log(`Authenticated as: ${user.login}`);

  const repoName = 'supernovavid';
  const repoDescription = 'Autonomous YouTube Thumbnail Optimization SaaS - AI-powered thumbnail generation, A/B testing, and optimization';

  // Check if repo exists
  let repoExists = false;
  try {
    await octokit.repos.get({
      owner: user.login,
      repo: repoName,
    });
    repoExists = true;
    console.log(`Repository ${repoName} already exists`);
  } catch (error: any) {
    if (error.status === 404) {
      console.log(`Repository ${repoName} does not exist, creating...`);
    } else {
      throw error;
    }
  }

  // Create repo if it doesn't exist
  if (!repoExists) {
    const { data: newRepo } = await octokit.repos.createForAuthenticatedUser({
      name: repoName,
      description: repoDescription,
      private: false,
      auto_init: false,
    });
    console.log(`Created repository: ${newRepo.html_url}`);
  }

  console.log(`\nRepository ready: https://github.com/${user.login}/${repoName}`);
  
  return {
    owner: user.login,
    repo: repoName,
    url: `https://github.com/${user.login}/${repoName}`,
  };
}

pushToGitHub()
  .then((result) => {
    console.log('\nSuccess! Repository info:', result);
  })
  .catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
  });
