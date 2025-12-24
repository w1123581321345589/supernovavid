// Script to sync code to GitHub repository using API
// Reference: connection:conn_github_01KCM63NJ1HZFJY576NMXEXNBM

import { Octokit } from '@octokit/rest';
import * as fs from 'fs';
import * as path from 'path';

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

// Files/directories to exclude
const excludePatterns = [
  'node_modules',
  '.git',
  '.cache',
  '.config',
  '.upm',
  'dist',
  '.replit',
  'replit.nix',
  '.env',
  '*.log',
  'package-lock.json',
  '.breakpoints',
  'generated-icon.png',
  'attached_assets',
  '/tmp',
];

function shouldExclude(filePath: string): boolean {
  for (const pattern of excludePatterns) {
    if (pattern.startsWith('*.')) {
      if (filePath.endsWith(pattern.slice(1))) return true;
    } else if (filePath.includes(pattern)) {
      return true;
    }
  }
  return false;
}

function getAllFiles(dir: string, baseDir: string = dir): string[] {
  const files: string[] = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const relativePath = path.relative(baseDir, fullPath);
    
    if (shouldExclude(relativePath) || shouldExclude(item)) {
      continue;
    }
    
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...getAllFiles(fullPath, baseDir));
    } else {
      files.push(relativePath);
    }
  }
  
  return files;
}

async function syncToGitHub() {
  console.log('Getting GitHub access token...');
  const accessToken = await getAccessToken();
  const octokit = new Octokit({ auth: accessToken });

  const { data: user } = await octokit.users.getAuthenticated();
  const owner = user.login;
  const repo = 'supernovavid';

  console.log(`Syncing to: https://github.com/${owner}/${repo}`);

  // Get all files to upload
  const projectDir = process.cwd();
  const files = getAllFiles(projectDir);
  console.log(`Found ${files.length} files to sync`);

  // Get or create the main branch
  let latestCommitSha: string | undefined;
  let treeSha: string | undefined;
  
  try {
    const { data: ref } = await octokit.git.getRef({
      owner,
      repo,
      ref: 'heads/main',
    });
    latestCommitSha = ref.object.sha;
    
    const { data: commit } = await octokit.git.getCommit({
      owner,
      repo,
      commit_sha: latestCommitSha,
    });
    treeSha = commit.tree.sha;
  } catch (error: any) {
    // 404 means no branch, 409 means empty repo - both are fine for initial commit
    if (error.status !== 404 && error.status !== 409) throw error;
    console.log('No existing commits, creating initial commit...');
  }

  // Create blobs for all files
  console.log('Uploading files...');
  const treeItems: any[] = [];
  
  for (const filePath of files) {
    const fullPath = path.join(projectDir, filePath);
    const content = fs.readFileSync(fullPath);
    
    // Check if it's a binary file
    const isBinary = content.includes(0x00);
    
    try {
      const { data: blob } = await octokit.git.createBlob({
        owner,
        repo,
        content: isBinary ? content.toString('base64') : content.toString('utf-8'),
        encoding: isBinary ? 'base64' : 'utf-8',
      });
      
      treeItems.push({
        path: filePath,
        mode: '100644',
        type: 'blob',
        sha: blob.sha,
      });
      
      process.stdout.write('.');
    } catch (error: any) {
      console.error(`\nError uploading ${filePath}:`, error.message);
    }
  }
  console.log('\n');

  // Create a tree
  console.log('Creating commit tree...');
  const { data: tree } = await octokit.git.createTree({
    owner,
    repo,
    tree: treeItems,
    base_tree: treeSha,
  });

  // Create a commit
  console.log('Creating commit...');
  const { data: commit } = await octokit.git.createCommit({
    owner,
    repo,
    message: 'Initial commit: SupernovaVid - Autonomous YouTube Thumbnail Optimization SaaS',
    tree: tree.sha,
    parents: latestCommitSha ? [latestCommitSha] : [],
  });

  // Update the main branch reference
  console.log('Updating main branch...');
  try {
    await octokit.git.updateRef({
      owner,
      repo,
      ref: 'heads/main',
      sha: commit.sha,
    });
  } catch (error: any) {
    if (error.status === 422) {
      // Branch doesn't exist, create it
      await octokit.git.createRef({
        owner,
        repo,
        ref: 'refs/heads/main',
        sha: commit.sha,
      });
    } else {
      throw error;
    }
  }

  console.log(`\nSuccess! Code pushed to: https://github.com/${owner}/${repo}`);
  console.log(`Commit: ${commit.sha.slice(0, 7)} - ${commit.message}`);
}

syncToGitHub().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
