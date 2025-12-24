// Script to initialize GitHub repo with README, then push all code
// Reference: connection:conn_github_01KCM63NJ1HZFJY576NMXEXNBM

import { Octokit } from '@octokit/rest';
import * as fs from 'fs';
import * as path from 'path';

let connectionSettings: any;

async function getAccessToken() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found');
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
  if (!accessToken) throw new Error('GitHub not connected');
  return accessToken;
}

// Files/directories to exclude
const excludePatterns = [
  'node_modules', '.git', '.cache', '.config', '.upm', 'dist', '.replit',
  'replit.nix', '.env', '*.log', 'package-lock.json', '.breakpoints',
  'generated-icon.png', 'attached_assets', '/tmp', '.local', 'drizzle',
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
  try {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const relativePath = path.relative(baseDir, fullPath);
      if (shouldExclude(relativePath) || shouldExclude(item)) continue;
      
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        files.push(...getAllFiles(fullPath, baseDir));
      } else if (stat.size < 1000000) { // Skip files > 1MB
        files.push(relativePath);
      }
    }
  } catch (e) {}
  return files;
}

async function initAndPush() {
  console.log('Connecting to GitHub...');
  const accessToken = await getAccessToken();
  const octokit = new Octokit({ auth: accessToken });

  const { data: user } = await octokit.users.getAuthenticated();
  const owner = user.login;
  const repo = 'supernovavid';

  console.log(`Target: https://github.com/${owner}/${repo}`);

  // Step 1: Initialize repo with README using contents API
  console.log('Initializing repository with README...');
  const readmeContent = fs.readFileSync('README.md', 'utf-8');
  
  try {
    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: 'README.md',
      message: 'Initial commit: SupernovaVid',
      content: Buffer.from(readmeContent).toString('base64'),
    });
    console.log('README.md created');
  } catch (e: any) {
    if (e.status === 422 && e.message.includes('sha')) {
      console.log('README already exists, updating...');
      const { data: existing } = await octokit.repos.getContent({ owner, repo, path: 'README.md' });
      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: 'README.md',
        message: 'Update README',
        content: Buffer.from(readmeContent).toString('base64'),
        sha: (existing as any).sha,
      });
    } else {
      throw e;
    }
  }

  // Step 2: Get the main branch reference
  console.log('Getting branch info...');
  const { data: ref } = await octokit.git.getRef({ owner, repo, ref: 'heads/main' });
  const latestCommitSha = ref.object.sha;
  const { data: latestCommit } = await octokit.git.getCommit({ owner, repo, commit_sha: latestCommitSha });

  // Step 3: Upload all files
  const projectDir = process.cwd();
  const files = getAllFiles(projectDir).filter(f => f !== 'README.md');
  console.log(`Uploading ${files.length} files...`);

  const treeItems: any[] = [];
  let uploaded = 0;
  
  for (const filePath of files) {
    try {
      const content = fs.readFileSync(path.join(projectDir, filePath));
      const isBinary = content.includes(0x00);
      
      const { data: blob } = await octokit.git.createBlob({
        owner,
        repo,
        content: isBinary ? content.toString('base64') : content.toString('utf-8'),
        encoding: isBinary ? 'base64' : 'utf-8',
      });
      
      treeItems.push({ path: filePath, mode: '100644', type: 'blob', sha: blob.sha });
      uploaded++;
      if (uploaded % 20 === 0) console.log(`  ${uploaded}/${files.length} files uploaded`);
    } catch (e: any) {
      console.log(`  Skipped: ${filePath} (${e.message?.slice(0, 50)})`);
    }
  }

  console.log(`Uploaded ${uploaded} files`);

  // Step 4: Create tree and commit
  console.log('Creating commit...');
  const { data: tree } = await octokit.git.createTree({
    owner,
    repo,
    tree: treeItems,
    base_tree: latestCommit.tree.sha,
  });

  const { data: newCommit } = await octokit.git.createCommit({
    owner,
    repo,
    message: 'Add complete SupernovaVid codebase\n\nAutonomous YouTube Thumbnail Optimization SaaS',
    tree: tree.sha,
    parents: [latestCommitSha],
  });

  await octokit.git.updateRef({ owner, repo, ref: 'heads/main', sha: newCommit.sha });

  console.log(`\nSuccess! Repository: https://github.com/${owner}/${repo}`);
  console.log(`Commit: ${newCommit.sha.slice(0, 7)}`);
}

initAndPush().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
