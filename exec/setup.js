const fs = require('fs');
const readline = require('readline');
const chalk = require('chalk');

function generateRandomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 40; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function setupLapsus() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log(chalk.green('\nWelcome to Lapsus Client Setup\n'));
  console.log(chalk.yellow('This will configure your settings.json file\n'));

  // Load current settings
  let settings;
  try {
    settings = JSON.parse(fs.readFileSync('./settings.json', 'utf8'));
  } catch (err) {
    console.error(chalk.red('Error reading settings.json:'), err);
    process.exit(1);
  }

  // Generate random 40-character alphanumeric code
  const randomCode = generateRandomCode();
  
  // Update both locations in settings.json
  settings.website.secret = randomCode;  // Line 13
  
  // Ensure proper structure exists for API client settings
  if (!settings.api) settings.api = { client: {} };
  if (!settings.api.client) settings.api.client = {};
  
  // Set the API code (line 51-52) - completely replace the old value
  settings.api.client.api = {
    enabled: true,
    code: randomCode  // Just the random code without "lapsus" prefix
  };

  const askQuestions = async () => {
    const questions = [
      {
        question: chalk.blue('Enter the host name (e.g., "Lapsus Client"): '),
        key: 'name',
        default: 'Lapsus Client'
      },
      {
        question: chalk.blue('Enter Pterodactyl domain (e.g., "https://panel.example.com"): '),
        key: 'pterodactyl.domain',
        default: 'https://panel.example.com'
      },
      {
        question: chalk.blue('Enter Pterodactyl API key: '),
        key: 'pterodactyl.key',
        default: 'ptla_'
      },
      {
        question: chalk.blue('Enter Pterodactyl account key: '),
        key: 'pterodactyl.account_key',
        default: 'ptlc_'
      },
      {
        question: chalk.blue('Enable telemetry? (y/n) [y]: '),
        key: 'telemetry',
        default: true,
        isBoolean: true
      },
      {
        question: chalk.blue('Enable auto updates? (y/n) [y]: '),
        key: 'auto_update',
        default: true,
        isBoolean: true
      }
    ];

    for (const q of questions) {
      const answer = await new Promise(resolve => {
        rl.question(q.question, (input) => {
          resolve(input.trim());
        });
      });

      if (q.isBoolean) {
        // Handle yes/no questions
        const value = answer === '' ? q.default : answer.toLowerCase() === 'y';
        setNestedValue(settings, q.key, value);
      } else {
        // Handle regular text inputs
        const value = answer === '' ? q.default : answer;
        setNestedValue(settings, q.key, value);
      }
    }

    // Save all changes to settings.json
    fs.writeFileSync('./settings.json', JSON.stringify(settings, null, 2), 'utf8');

    console.log(chalk.green('\nSetup completed successfully!'));
    console.log(chalk.gray('\nThanks for using Lapsus Client'));
    console.log(chalk.gray('* Leave a like on the repository\n'));
    
    rl.close();
    process.exit(0);
  };

  // Helper function to set nested object values
  function setNestedValue(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
  }

  askQuestions();
}

// Start the setup process
setupLapsus();