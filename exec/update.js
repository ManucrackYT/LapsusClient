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

async function installUpdate(newVersion) {
    try {
        console.log(chalk.blue("[UPDATE] Installing update..."));

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
        
        // Backup settings file first
        const settingsBackup = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
        
        // Copy all files except settings.json to preserve configuration
        const filesToCopy = fs.readdirSync(extractedPath);
        for (const file of filesToCopy) {
            if (file !== "settings.json") {
                const sourcePath = path.join(extractedPath, file);
                const destPath = path.join(APP_DIR, file);
                await fse.copy(sourcePath, destPath, { overwrite: true });
            }
        }

        // Clean up
        fs.unlinkSync(UPDATE_DIR);
        await fse.remove(tempDir);

        // Update version in settings
        settingsBackup.version = newVersion;
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settingsBackup, null, 2));

        console.log(chalk.green("[UPDATE] Update installed successfully."));
        return true;
    } catch (error) {
        console.error(chalk.red("[UPDATE] Error installing update:"), error);
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