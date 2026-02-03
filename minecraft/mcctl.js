#!/usr/bin/env node

/**
 * Minecraft Server Controller
 * Manages multiple Minecraft server instances with different mods and versions
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_FILE = path.join(__dirname, 'config.json');
const WHITELIST_FILE = path.join(__dirname, 'whitelist.json');

class MinecraftServerController {
    constructor() {
        this.config = this.loadConfig();
        this.whitelist = this.loadWhitelist();
        this.serverProcess = null;
        this.currentProfile = null;
        this.logBuffer = [];
        this.isAttached = false;
    }

    loadConfig() {
        if (!fs.existsSync(CONFIG_FILE)) {
            const defaultConfig = {
                profiles: {
                    'hideseek': {
                        name: 'Hide & Seek',
                        version: '1.21.8',
                        serverDir: path.join(__dirname, 'servers', 'hideseek'),
                        worldDir: path.join(__dirname, 'servers', 'hideseek', 'world'),
                        javaPath: 'java',
                        minMemory: '2G',
                        maxMemory: '4G',
                        port: 25565,
                        mods: [
                            'https://cdn.modrinth.com/data/hide-seek-mod-id/versions/...'
                        ]
                    },
                    'twilight': {
                        name: 'Twilight Forest',
                        version: '1.20.1',
                        serverDir: path.join(__dirname, 'servers', 'twilight'),
                        worldDir: path.join(__dirname, 'servers', 'twilight', 'world'),
                        javaPath: 'java',
                        minMemory: '2G',
                        maxMemory: '4G',
                        port: 25565,
                        mods: [
                            'https://cdn.modrinth.com/data/twilight-forest/versions/...'
                        ]
                    }
                },
                currentProfile: 'hideseek'
            };
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
            return defaultConfig;
        }
        return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }

    loadWhitelist() {
        if (!fs.existsSync(WHITELIST_FILE)) {
            fs.writeFileSync(WHITELIST_FILE, JSON.stringify([], null, 2));
            return [];
        }
        return JSON.parse(fs.readFileSync(WHITELIST_FILE, 'utf8'));
    }

    saveConfig() {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2));
    }

    saveWhitelist() {
        fs.writeFileSync(WHITELIST_FILE, JSON.stringify(this.whitelist, null, 2));

        // Update whitelist in active server directory
        if (this.currentProfile) {
            const profile = this.config.profiles[this.currentProfile];
            const serverWhitelist = path.join(profile.serverDir, 'whitelist.json');

            // Convert to Minecraft whitelist format
            const mcWhitelist = this.whitelist.map(player => ({
                uuid: player.uuid || this.generateOfflineUUID(player.name),
                name: player.name
            }));

            fs.writeFileSync(serverWhitelist, JSON.stringify(mcWhitelist, null, 2));
        }
    }

    generateOfflineUUID(username) {
        // Generate offline mode UUID (placeholder - use proper UUID generation in production)
        const hash = crypto.createHash('md5').update('OfflinePlayer:' + username).digest('hex');
        return `${hash.substr(0,8)}-${hash.substr(8,4)}-3${hash.substr(13,3)}-${hash.substr(16,4)}-${hash.substr(20,12)}`;
    }

    // Whitelist commands
    whitelistAdd(playerName) {
        if (this.whitelist.some(p => p.name === playerName)) {
            console.log(`Player ${playerName} is already whitelisted.`);
            return;
        }

        this.whitelist.push({ name: playerName, addedAt: new Date().toISOString() });
        this.saveWhitelist();
        console.log(`Added ${playerName} to whitelist.`);

        if (this.serverProcess) {
            this.sendCommand(`whitelist add ${playerName}`);
        }
    }

    whitelistRemove(playerName) {
        const index = this.whitelist.findIndex(p => p.name === playerName);
        if (index === -1) {
            console.log(`Player ${playerName} is not on the whitelist.`);
            return;
        }

        this.whitelist.splice(index, 1);
        this.saveWhitelist();
        console.log(`Removed ${playerName} from whitelist.`);

        if (this.serverProcess) {
            this.sendCommand(`whitelist remove ${playerName}`);
        }
    }

    whitelistShow() {
        console.log('\n=== Whitelist ===');
        if (this.whitelist.length === 0) {
            console.log('No players whitelisted.');
        } else {
            this.whitelist.forEach((player, i) => {
                console.log(`${i + 1}. ${player.name} (added: ${player.addedAt})`);
            });
        }
        console.log('');
    }

    // Server profile switching
    switchProfile(profileName) {
        if (!this.config.profiles[profileName]) {
            console.log(`Profile "${profileName}" does not exist.`);
            console.log('Available profiles:', Object.keys(this.config.profiles).join(', '));
            return false;
        }

        if (this.serverProcess) {
            console.log('Server is currently running. Please stop it first.');
            return false;
        }

        this.config.currentProfile = profileName;
        this.currentProfile = profileName;
        this.saveConfig();
        console.log(`Switched to profile: ${this.config.profiles[profileName].name} (${profileName})`);
        return true;
    }

    // World regeneration
    async regenerateWorld(profileName, seed = null) {
        const profile = this.config.profiles[profileName];
        if (!profile) {
            console.log(`Profile "${profileName}" does not exist.`);
            return;
        }

        if (this.serverProcess && this.currentProfile === profileName) {
            console.log('Server is running. Please stop it first.');
            return;
        }

        const worldDir = profile.worldDir;

        console.log(`Regenerating world for ${profile.name}...`);

        // Backup old world
        if (fs.existsSync(worldDir)) {
            const backupDir = `${worldDir}_backup_${Date.now()}`;
            console.log(`Backing up old world to: ${backupDir}`);
            fs.renameSync(worldDir, backupDir);
        }

        // Create server.properties with new seed if provided
        const serverProps = path.join(profile.serverDir, 'server.properties');
        if (fs.existsSync(serverProps)) {
            let props = fs.readFileSync(serverProps, 'utf8');
            if (seed) {
                props = props.replace(/level-seed=.*/g, `level-seed=${seed}`);
                console.log(`Set new seed: ${seed}`);
            }
            fs.writeFileSync(serverProps, props);
        }

        console.log('World will be regenerated on next server start.');
    }

    // Server control
    async startServer() {
        if (this.serverProcess) {
            console.log('Server is already running.');
            return;
        }

        const profileName = this.config.currentProfile;
        if (!profileName) {
            console.log('No profile selected. Use "switch" command first.');
            return;
        }

        this.currentProfile = profileName;
        const profile = this.config.profiles[profileName];
        const serverJar = path.join(profile.serverDir, 'server.jar');

        if (!fs.existsSync(serverJar)) {
            console.log(`Server jar not found at: ${serverJar}`);
            console.log('Please download the appropriate Fabric server jar first.');
            return;
        }

        console.log(`Starting ${profile.name} server (Minecraft ${profile.version})...`);
        console.log(`Server directory: ${profile.serverDir}`);

        const args = [
            `-Xms${profile.minMemory}`,
            `-Xmx${profile.maxMemory}`,
            '-jar',
            'server.jar',
            'nogui'
        ];

        this.serverProcess = spawn(profile.javaPath, args, {
            cwd: profile.serverDir,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        this.serverProcess.stdout.on('data', (data) => {
            const lines = data.toString().split('\n').filter(l => l.trim());
            lines.forEach(line => {
                this.logBuffer.push(`[MC] ${line}`);
                if (this.logBuffer.length > 1000) this.logBuffer.shift();
                if (this.isAttached) {
                    console.log(`[MC] ${line}`);
                }
            });
        });

        this.serverProcess.stderr.on('data', (data) => {
            const lines = data.toString().split('\n').filter(l => l.trim());
            lines.forEach(line => {
                this.logBuffer.push(`[MC ERROR] ${line}`);
                if (this.logBuffer.length > 1000) this.logBuffer.shift();
                if (this.isAttached) {
                    console.error(`[MC ERROR] ${line}`);
                }
            });
        });

        this.serverProcess.on('close', (code) => {
            console.log(`\nServer process exited with code ${code}`);
            this.serverProcess = null;
            this.currentProfile = null;
        });

        // Apply whitelist
        setTimeout(() => {
            this.sendCommand('whitelist on');
            this.whitelist.forEach(player => {
                this.sendCommand(`whitelist add ${player.name}`);
            });
        }, 5000);

        console.log('Server started. Use "attach" to interact with server console.');
    }

    async stopServer() {
        if (!this.serverProcess) {
            console.log('Server is not running.');
            return;
        }

        console.log('Stopping server...');
        this.sendCommand('stop');

        // Wait for graceful shutdown
        await new Promise((resolve) => {
            const timeout = setTimeout(() => {
                if (this.serverProcess) {
                    console.log('Force killing server...');
                    this.serverProcess.kill('SIGKILL');
                }
                resolve();
            }, 30000);

            if (this.serverProcess) {
                this.serverProcess.on('close', () => {
                    clearTimeout(timeout);
                    resolve();
                });
            } else {
                clearTimeout(timeout);
                resolve();
            }
        });

        this.serverProcess = null;
        this.currentProfile = null;
        console.log('Server stopped.');
    }

    async restartServer() {
        console.log('Restarting server...');
        await this.stopServer();
        await new Promise(resolve => setTimeout(resolve, 2000));
        await this.startServer();
    }

    sendCommand(command) {
        if (!this.serverProcess) {
            console.log('Server is not running.');
            return;
        }

        this.serverProcess.stdin.write(command + '\n');
    }

    attachConsole() {
        if (!this.serverProcess) {
            console.log('Server is not running.');
            return;
        }

        this.isAttached = true;
        console.log('\n=== Server Console (showing last 20 lines) ===');
        const recentLogs = this.logBuffer.slice(-20);
        recentLogs.forEach(log => console.log(log));
        console.log('=== Live Output (press ESC to exit) ===\n');

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: 'MC> ',
            terminal: true
        });

        // Enable raw mode to capture ESC key
        process.stdin.setRawMode(true);
        process.stdin.resume();

        // Handle ESC key (ASCII 27)
        process.stdin.on('data', (key) => {
            if (key[0] === 27) { // ESC key
                this.isAttached = false;
                process.stdin.setRawMode(false);
                process.stdin.removeAllListeners('data');
                rl.close();
                return;
            }
        });

        rl.prompt();

        rl.on('line', (line) => {
            // Send all commands directly to server
            this.sendCommand(line);
            rl.prompt();
        });

        rl.on('close', () => {
            this.isAttached = false;
            process.stdin.setRawMode(false);
            process.stdin.removeAllListeners('data');
            console.log('Detached from console.');
        });
    }

    showStatus() {
        console.log('\n=== Minecraft Server Status ===');
        console.log(`Current Profile: ${this.config.currentProfile || 'None'}`);

        if (this.config.currentProfile) {
            const profile = this.config.profiles[this.config.currentProfile];
            console.log(`Version: ${profile.version}`);
            console.log(`Server: ${profile.name}`);
        }

        console.log(`Server Running: ${this.serverProcess ? 'Yes' : 'No'}`);
        console.log(`Whitelisted Players: ${this.whitelist.length}`);
        console.log('');
    }

    printHelp() {
        console.log(`
Minecraft Server Controller - Commands:

Server Control:
  start                 - Start the current profile's server
  stop                  - Stop the running server
  restart               - Restart the server
  status                - Show server status
  attach                - Attach to server console

Profile Management:
  switch <profile>      - Switch to a different server profile
                         Profiles: hideseek, twilight
  profiles              - List all available profiles

Whitelist Management:
  whitelist add <name>  - Add a player to the whitelist
  whitelist remove <name> - Remove a player from the whitelist
  whitelist show        - Show all whitelisted players

World Management:
  regen <profile> [seed] - Regenerate world for a profile (optional seed)
                          Example: regen hideseek 12345

Other:
  help                  - Show this help message
  exit                  - Exit the controller (stops server if running)
`);
    }

    async handleCommand(command, ...args) {
        switch (command) {
            case 'start':
                await this.startServer();
                break;
            case 'stop':
                await this.stopServer();
                break;
            case 'restart':
                await this.restartServer();
                break;
            case 'status':
                this.showStatus();
                break;
            case 'attach':
                this.attachConsole();
                break;
            case 'switch':
                this.switchProfile(args[0]);
                break;
            case 'profiles':
                console.log('Available profiles:');
                Object.entries(this.config.profiles).forEach(([key, profile]) => {
                    const current = key === this.config.currentProfile ? ' (current)' : '';
                    console.log(`  ${key}: ${profile.name} - Minecraft ${profile.version}${current}`);
                });
                break;
            case 'whitelist':
                const subCmd = args[0];
                if (subCmd === 'add') {
                    this.whitelistAdd(args[1]);
                } else if (subCmd === 'remove') {
                    this.whitelistRemove(args[1]);
                } else if (subCmd === 'show') {
                    this.whitelistShow();
                } else {
                    console.log('Usage: whitelist <add|remove|show> [player]');
                }
                break;
            case 'regen':
                await this.regenerateWorld(args[0], args[1]);
                break;
            case 'help':
                this.printHelp();
                break;
            case 'exit':
                if (this.serverProcess) {
                    await this.stopServer();
                }
                process.exit(0);
                break;
            default:
                console.log(`Unknown command: ${command}`);
                console.log('Type "help" for available commands.');
        }
    }

    async run() {
        console.log('=== Minecraft Server Controller ===\n');
        this.showStatus();
        this.printHelp();

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: 'mcctl> '
        });

        rl.prompt();

        rl.on('line', async (line) => {
            const parts = line.trim().split(/\s+/);
            const command = parts[0];
            const args = parts.slice(1);

            if (command) {
                await this.handleCommand(command, ...args);
            }

            rl.prompt();
        });

        rl.on('close', () => {
            console.log('\nShutting down...');
            if (this.serverProcess) {
                this.stopServer().then(() => process.exit(0));
            } else {
                process.exit(0);
            }
        });
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`.replace(/\\/g, '/')) {
    const controller = new MinecraftServerController();
    controller.run();
}

export default MinecraftServerController;
