const fs = require('fs');
const readline = require('readline');
const chalk = require('chalk');
const path = require('path');

function setupNode() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log(chalk.green('\nLapsus Node Configuration\n'));
  console.log(chalk.yellow('This will configure node settings at line 146 in settings.json\n'));

  const settingsPath = path.join(__dirname, '../settings.json');

  // Read the entire file as lines
  let settingsLines;
  try {
    settingsLines = fs.readFileSync(settingsPath, 'utf8').split('\n');
  } catch (err) {
    console.error(chalk.red('Error reading settings.json:'), err);
    process.exit(1);
  }

  // Find the locations line (around line 146)
  let locationsIndex = -1;
  for (let i = 0; i < settingsLines.length; i++) {
    if (settingsLines[i].includes('"locations":')) {
      locationsIndex = i;
      break;
    }
  }

  // If locations not found, create it at line 146 (145 in 0-based index)
  if (locationsIndex === -1) {
    locationsIndex = 145;
    // Ensure we have enough lines (pad if necessary)
    while (settingsLines.length <= locationsIndex) {
      settingsLines.push('');
    }
    settingsLines.splice(locationsIndex, 0, '    "locations": {},');
  }

  // Extract the current locations content
  let locations = {};
  try {
    const lineContent = settingsLines[locationsIndex];
    const match = lineContent.match(/"locations":\s*({[^}]*})/);
    if (match && match[1]) {
      locations = JSON.parse(match[1]);
    }
  } catch (err) {
    console.log(chalk.yellow('Starting with empty locations (could not parse existing)'));
  }

  const askQuestions = async () => {
    const nodeId = await new Promise(resolve => {
      rl.question(chalk.blue('\nEnter Node ID (e.g., "2"): '), (input) => {
        resolve(input.trim());
      });
    });

    const nodeName = await new Promise(resolve => {
      rl.question(chalk.blue('Enter Node Name (e.g., "Germany"): '), (input) => {
        resolve(input.trim());
      });
    });

    const city = await new Promise(resolve => {
      rl.question(chalk.blue('Enter City (e.g., "Berlin"): '), (input) => {
        resolve(input.trim());
      });
    });

    console.log(chalk.yellow('\nISO Code is a 2-letter country code (e.g., "de" for Germany)'));
    const iso = await new Promise(resolve => {
      rl.question(chalk.blue('Enter ISO Country Code: '), (input) => {
        resolve(input.trim().toLowerCase());
      });
    });

    const pkg = await new Promise(resolve => {
      rl.question(chalk.blue('Enter Package (leave empty for null): '), (input) => {
        resolve(input.trim() || null);
      });
    });

    // Update locations
    locations[nodeId] = {
      name: nodeName,
      city: city,
      ISO: iso,
      package: pkg
    };

    // Create the new locations line with proper indentation
    const locationsString = JSON.stringify(locations, null, 4)
      .split('\n')
      .map((line, i) => i === 0 ? line : '        ' + line)
      .join('\n');

    // Update the specific line while preserving the original indentation
    const originalIndent = settingsLines[locationsIndex].match(/^\s*/)[0];
    settingsLines[locationsIndex] = originalIndent + '"locations": ' + locationsString + ',';

    // Write back to file
    try {
      fs.writeFileSync(settingsPath, settingsLines.join('\n'), 'utf8');
      console.log(chalk.green('\nSuccessfully updated node at line ' + (locationsIndex + 1) + ' in settings.json!'));
      console.log(chalk.gray('\nCurrent node configuration:'));
      console.log(chalk.gray(JSON.stringify(locations, null, 2)));
    } catch (err) {
      console.error(chalk.red('Error writing settings.json:'), err);
      process.exit(1);
    }

    rl.close();
  };

  askQuestions();
}

setupNode();