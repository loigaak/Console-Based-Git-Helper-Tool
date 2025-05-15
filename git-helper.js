#!/usr/bin/env node

const { program } = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

const HISTORY_FILE = path.join(process.env.HOME || process.env.USERPROFILE, '.git_helper_history.json');

// Execute Git command and return output
function runGitCommand(command) {
  try {
    return execSync(`git ${command}`, { encoding: 'utf8' }).trim();
  } catch (error) {
    throw new Error(`Git command failed: ${error.message}`);
  }
}

// Save command to history
async function saveCommand(command) {
  const history = await loadHistory();
  history.push({ command, timestamp: new Date().toISOString() });
  history.splice(100); // Keep last 100 commands
  await fs.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2));
}

// Load command history
async function loadHistory() {
  try {
    const data = await fs.readFile(HISTORY_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// Initialize a new Git repository
async function initRepo() {
  try {
    runGitCommand('init');
    const { gitignore } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'gitignore',
        message: 'Create a .gitignore file?',
        default: true,
      },
    ]);
    if (gitignore) {
      await fs.writeFile('.gitignore', 'node_modules\n.env\n');
      runGitCommand('add .gitignore');
      runGitCommand('commit -m "Initial commit with .gitignore"');
    }
    await saveCommand('init');
    console.log(chalk.green('Git repository initialized!'));
  } catch (error) {
    console.log(chalk.red(error.message));
  }
}

// Create and switch to a new branch
async function createBranch(name) {
  try {
    runGitCommand(`checkout -b ${name}`);
    await saveCommand(`checkout -b ${name}`);
    console.log(chalk.green(`Switched to new branch "${name}"!`));
  } catch (error) {
    console.log(chalk.red(error.message));
  }
}

// Stage and commit changes
async function commitChanges(message) {
  try {
    if (!message) {
      const { msg } = await inquirer.prompt([
        {
          type: 'input',
          name: 'msg',
          message: 'Enter commit message:',
          default: 'Update',
        },
      ]);
      message = msg;
    }
    runGitCommand('add .');
    runGitCommand(`commit -m "${message}"`);
    await saveCommand(`commit -m "${message}"`);
    console.log(chalk.green(`Changes committed with message: "${message}"`));
  } catch (error) {
    console.log(chalk.red(error.message));
  }
}

// Push changes to remote
async function pushChanges() {
  try {
    const { remote, branch } = await inquirer.prompt([
      {
        type: 'input',
        name: 'remote',
        message: 'Remote name:',
        default: 'origin',
      },
      {
        type: 'input',
        name: 'branch',
        message: 'Branch name:',
        default: runGitCommand('branch --show-current').trim(),
      },
    ]);
    runGitCommand(`push ${remote} ${branch}`);
    await saveCommand(`push ${remote} ${branch}`);
    console.log(chalk.green(`Pushed to ${remote}/${branch}!`));
  } catch (error) {
    console.log(chalk.red(error.message));
  }
}

// Show repository status
function showStatus() {
  try {
    const status = runGitCommand('status');
    console.log(chalk.blue('Repository Status:'));
    console.log(chalk.gray(status));
    saveCommand('status');
  } catch (error) {
    console.log(chalk.red(error.message));
  }
}

// Show command history
async function showHistory() {
  const history = await loadHistory();
  if (!history.length) {
    console.log(chalk.yellow('No command history yet.'));
    return;
  }
  console.log(chalk.blue('Recent Git Commands:'));
  history.forEach((entry, index) => {
    console.log(`${index + 1}. ${entry.command} (${entry.timestamp})`);
  });
}

program
  .command('init')
  .description('Initialize a new Git repository')
  .action(() => initRepo());

program
  .command('branch <name>')
  .description('Create and switch to a new branch')
  .action((name) => createBranch(name));

program
  .command('commit [message]')
  .description('Stage and commit changes')
  .action((message) => commitChanges(message));

program
  .command('push')
  .description('Push changes to a remote repository')
  .action(() => pushChanges());

program
  .command('status')
  .description('Show repository status')
  .action(() => showStatus());

program
  .command('history')
  .description('Show recent Git commands')
  .action(() => showHistory());

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
  console.log(chalk.cyan('Use the "init" command to start a new repository!'));
}
