const fs = require("fs");
const https = require("https");
const path = require("path");
const chalk = require("chalk");
const unzipper = require("unzipper");
const { exec } = require("child_process");
const fse = require("fs-extra");

const REPO_OWNER = "ManucrackYT";
const REPO_NAME = "LapsusClient";
const GITHUB_API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;
const SETTINGS_FILE = path.join(__dirname, "../settings.json");
const UPDATE_DIR = path.join(__dirname, "../update.zip");
const APP_DIR = path.dirname(__dirname);
const DATABASE_FILE = path.join(__dirname, "../database.sqlite");

function getCurrentVersion() {
    try {
        const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
        return settings.version;
    } catch (error) {
        console.error("Error reading settings.json:", error);
        return "0.0.0";
    }
}

async function checkForUpdates() {
    try {
        console.log(chalk.blue("[UPDATE] Checking for updates..."));

        const response = await fetch(GITHUB_API, {
            headers: { "User-Agent": "LapsusClient-Updater" },
        });
        
        if (!response.ok) {
            throw new Error(`GitHub API responded with status: ${response.status}`);
        }
        
        const data = await response.json();

        if (!data || !data.tag_name) {
            console.log(chalk.yellow("[UPDATE] No releases found or invalid response from GitHub."));
            return false;
        }

        const latestVersion = data.tag_name.replace("v", "");
        const currentVersion = getCurrentVersion();

        console.log(chalk.gray(`[UPDATE] Current version: ${currentVersion}`));
        console.log(chalk.gray(`[UPDATE] Latest version: ${latestVersion}`));

        if (latestVersion !== currentVersion) {
            console.log(chalk.green(`[UPDATE] New version available: ${latestVersion}`));
            return {
                available: true,
                version: latestVersion,
                zip_url: data.zipball_url
            };
        } else {
            console.log(chalk.magenta("[UPDATE] No updates available. You're running the latest version."));
            return { available: false };
        }
    } catch (error) {
        console.error(chalk.red("[UPDATE] Error checking for updates:"), error);
        return { available: false, error: error.message };
    }
}

async function getFinalRedirectUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { "User-Agent": "LapsusClient-Updater" } }, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                resolve(response.headers.location);
            } else if (response.statusCode === 200) {
                resolve(url);
            } else {
                reject(new Error(`Unexpected response: ${response.statusCode}`));
            }
        }).on("error", (error) => reject(error));
    });
}

async function downloadUpdate(url, newVersion) {
    console.log(chalk.blue("[UPDATE] Downloading update..."));
    
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(UPDATE_DIR);

        const options = { headers: { "User-Agent": "LapsusClient-Updater" } };
        https.get(url, options, (response) => {
            if (response.statusCode !== 200) {
                console.error(chalk.red("[UPDATE] Failed to download update, HTTP Status:"), response.statusCode);
                reject(new Error("Download failed"));
                return;
            }

            response.pipe(file);

            file.on("finish", () => {
                file.close();
                console.log(chalk.green("[UPDATE] Update downloaded successfully."));
                resolve();
            });

            file.on("error", (error) => {
                console.error(chalk.red("[UPDATE] Error writing update file:"), error);
                reject(error);
            });
        }).on("error", (error) => {
            console.error(chalk.red("[UPDATE] Download request failed:"), error);
            reject(error);
        });
    });
}

// Deep merge function that preserves existing values at all levels
function deepMergeWithPreservation(existing, updates) {
    const result = { ...existing };
    
    for (const [key, newValue] of Object.entries(updates)) {
        if (!(key in existing)) {
            // Key doesn't exist in user settings, add it
            result[key] = newValue;
            console.log(chalk.cyan(`[UPDATE] Added new setting: ${key} = ${JSON.stringify(newValue)}`));
        } else if (typeof newValue === 'object' && newValue !== null && 
                 typeof existing[key] === 'object' && existing[key] !== null &&
                 !Array.isArray(newValue) && !Array.isArray(existing[key])) {
            // Both are objects, recursively merge nested objects
            console.log(chalk.gray(`[UPDATE] Merging nested object: ${key}`));
            result[key] = deepMergeWithPreservation(existing[key], newValue);
        }
        // If key already exists in user settings, preserve user's value
        // (do nothing - result already has user's value)
    }
    
    return result;
}

async function installUpdate(newVersion) {
    try {
        console.log(chalk.blue("[UPDATE] Installing update..."));

        // Backup database if it exists
        const databaseExists = fse.existsSync(DATABASE_FILE);
        if (databaseExists) {
            console.log(chalk.blue("[UPDATE] Backing up database..."));
            await fse.copy(DATABASE_FILE, DATABASE_FILE + '.backup');
        }

        const tempDir = path.join(__dirname, "../temp_update");
        await fse.ensureDir(tempDir);

        await fs.createReadStream(UPDATE_DIR)
            .pipe(unzipper.Extract({ path: tempDir }))
            .promise();

        const extractedFolders = fs.readdirSync(tempDir);
        if (extractedFolders.length === 0) {
            throw new Error("No files found in update package");
        }

        const extractedPath = path.join(tempDir, extractedFolders[0]);
        
        // Read current settings
        const currentSettings = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
        
        // Copy all files except settings.json and database.sqlite
        const filesToCopy = fs.readdirSync(extractedPath);
        for (const file of filesToCopy) {
            if (file !== "settings.json" && file !== "database.sqlite") {
                const sourcePath = path.join(extractedPath, file);
                const destPath = path.join(APP_DIR, file);
                
                // Check if it's a directory or file
                const stat = fs.statSync(sourcePath);
                if (stat.isDirectory()) {
                    await fse.copy(sourcePath, destPath, { overwrite: true });
                } else {
                    await fse.copy(sourcePath, destPath, { overwrite: true });
                }
                console.log(chalk.gray(`[UPDATE] Updated: ${file}`));
            } else if (file === "database.sqlite") {
                console.log(chalk.yellow(`[UPDATE] Skipping database.sqlite (preserving existing database)`));
            }
        }

        // Merge settings from update with existing settings
        const newSettingsPath = path.join(extractedPath, "settings.json");
        if (fs.existsSync(newSettingsPath)) {
            console.log(chalk.blue("[UPDATE] Merging new settings with existing settings..."));
            const newSettings = JSON.parse(fs.readFileSync(newSettingsPath, "utf8"));
            
            // Deep merge preserving all user values
            const mergedSettings = deepMergeWithPreservation(currentSettings, newSettings);
            
            // Update version
            mergedSettings.version = newVersion;
            
            // Save merged settings
            fs.writeFileSync(SETTINGS_FILE, JSON.stringify(mergedSettings, null, 2));
            console.log(chalk.green("[UPDATE] Settings merged successfully - preserved user values"));
        } else {
            // Just update version if no settings file in update
            currentSettings.version = newVersion;
            fs.writeFileSync(SETTINGS_FILE, JSON.stringify(currentSettings, null, 2));
        }

        // Clean up
        fs.unlinkSync(UPDATE_DIR);
        await fse.remove(tempDir);
        
        // Remove database backup if update succeeded
        if (databaseExists && fse.existsSync(DATABASE_FILE + '.backup')) {
            fs.unlinkSync(DATABASE_FILE + '.backup');
            console.log(chalk.gray("[UPDATE] Cleaned up database backup"));
        }

        console.log(chalk.green("[UPDATE] Update installed successfully."));
        return true;
        
    } catch (error) {
        console.error(chalk.red("[UPDATE] Error installing update:"), error);
        
        // Try to restore database from backup if update failed
        if (fse.existsSync(DATABASE_FILE + '.backup')) {
            console.log(chalk.yellow("[UPDATE] Restoring database from backup..."));
            await fse.copy(DATABASE_FILE + '.backup', DATABASE_FILE, { overwrite: true });
            fs.unlinkSync(DATABASE_FILE + '.backup');
        }
        
        return false;
    }
}

async function main() {
    try {
        const updateInfo = await checkForUpdates();
        
        if (updateInfo.available) {
            console.log(chalk.blue("[UPDATE] Starting update process..."));
            
            // Get final redirect URL
            const finalUrl = await getFinalRedirectUrl(updateInfo.zip_url);
            
            // Download update
            await downloadUpdate(finalUrl, updateInfo.version);
            
            // Install update
            const success = await installUpdate(updateInfo.version);
            
            if (success) {
                console.log(chalk.green("[UPDATE] Update completed successfully!"));
                console.log(chalk.yellow("[UPDATE] Please restart the application to apply changes."));
            } else {
                console.log(chalk.red("[UPDATE] Update failed."));
            }
        }
    } catch (error) {
        console.error(chalk.red("[UPDATE] Update process failed:"), error);
    }
}

// Run the update check
main();