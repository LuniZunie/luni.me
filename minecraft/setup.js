#!/usr/bin/env node

/**
 * Minecraft Server Setup Script
 * Downloads and configures Fabric servers for both profiles
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_FILE = path.join(__dirname, 'config.json');

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        console.log(`Downloading ${url}...`);

        https.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                // Follow redirect
                file.close();
                fs.unlinkSync(dest);
                return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
            }

            response.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log(`Downloaded to ${dest}`);
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => {});
            reject(err);
        });
    });
}

async function setupServerProfile(profileName, config) {
    console.log(`\n=== Setting up ${config.name} (${profileName}) ===`);

    const serverDir = path.join(__dirname, config.serverDir);

    // Create server directory
    if (!fs.existsSync(serverDir)) {
        fs.mkdirSync(serverDir, { recursive: true });
        console.log(`Created directory: ${serverDir}`);
    }

    // Download Fabric server installer
    const fabricInstallerUrl = `https://meta.fabricmc.net/v2/versions/loader/${config.version}/${config.fabricVersion}/1.0.1/server/jar`;
    const serverJar = path.join(serverDir, 'server.jar');

    if (!fs.existsSync(serverJar)) {
        console.log('Downloading Fabric server...');
        try {
            await downloadFile(fabricInstallerUrl, serverJar);
        } catch (error) {
            console.error(`Failed to download Fabric server: ${error.message}`);
            console.log(`\nPlease manually download Fabric server for Minecraft ${config.version}:`);
            console.log(`  1. Visit: https://fabricmc.net/use/server/`);
            console.log(`  2. Download Fabric Server for Minecraft ${config.version}`);
            console.log(`  3. Save as: ${serverJar}`);
            return;
        }
    } else {
        console.log('Server jar already exists.');
    }

    // Create mods directory
    const modsDir = path.join(serverDir, 'mods');
    if (!fs.existsSync(modsDir)) {
        fs.mkdirSync(modsDir);
        console.log(`Created mods directory: ${modsDir}`);
    }

    // Create eula.txt
    const eulaFile = path.join(serverDir, 'eula.txt');
    fs.writeFileSync(eulaFile, 'eula=true\n');
    console.log('Accepted EULA');

    // Create server.properties
    const serverProps = path.join(serverDir, 'server.properties');
    if (!fs.existsSync(serverProps)) {
        const properties = `
# Minecraft server properties
server-port=${config.port}
gamemode=survival
difficulty=normal
spawn-protection=0
max-players=10
white-list=true
enforce-whitelist=true
enable-command-block=true
online-mode=true
pvp=true
level-name=world
level-seed=
motd=${config.name} Server - luni.me
`;
        fs.writeFileSync(serverProps, properties.trim());
        console.log('Created server.properties');
    }

    // Create empty whitelist
    const whitelistFile = path.join(serverDir, 'whitelist.json');
    if (!fs.existsSync(whitelistFile)) {
        fs.writeFileSync(whitelistFile, '[]');
        console.log('Created whitelist.json');
    }

    console.log(`\n${config.name} setup complete!`);
    console.log(`Server directory: ${serverDir}`);
    console.log(`\nIMPORTANT: You need to manually download the mods:`);

    if (profileName === 'hideseek') {
        console.log(`  1. Hide & Seek mod: https://modrinth.com/mod/hide-n-seek`);
        console.log(`     Download the Fabric version for Minecraft 1.21.8`);
    } else if (profileName === 'twilight') {
        console.log(`  1. Twilight Forest mod: https://modrinth.com/mod/the-twilight-forest`);
        console.log(`     Download the Fabric version for Minecraft 1.20.1`);
    }
    console.log(`  2. Place the .jar file in: ${modsDir}`);
}

async function main() {
    console.log('=== Minecraft Server Setup ===\n');

    if (!fs.existsSync(CONFIG_FILE)) {
        console.error('Config file not found:', CONFIG_FILE);
        process.exit(1);
    }

    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));

    // Setup both profiles
    for (const [profileName, profileConfig] of Object.entries(config.profiles)) {
        await setupServerProfile(profileName, profileConfig);
    }

    console.log('\n=== Setup Complete ===');
    console.log('\nNext steps:');
    console.log('1. Download the mods as instructed above');
    console.log('2. Run: node mcctl.js');
    console.log('3. Use "whitelist add <yourname>" to add yourself');
    console.log('4. Use "start" to start the server');
    console.log('\nNote: Make sure Java 17 or later is installed!');
}

main().catch(console.error);
