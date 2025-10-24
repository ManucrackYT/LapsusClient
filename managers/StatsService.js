const fetch = require('node-fetch');
const chalk = require('chalk');

class StatsService {
  constructor(settings, db) {
    this.settings = settings;
    this.db = db;
    this.io = null;
    this.updateInterval = 5000;
    this.serverStats = new Map();
    this.intervalId = null;
  }

  initialize(io) {
    this.io = io;
    console.log(chalk.green('[STATS] Real-time stats service initialized'));
    this.startPolling();
  }

  startPolling() {
    if (this.intervalId) return;
    this.intervalId = setInterval(async () => {
      await this.pollAllServers();
    }, this.updateInterval);
    this.pollAllServers();
  }

  stopPolling() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async pollAllServers() {
    try {
      const userKeys = await this.getAllUserKeys();
      for (const userKey of userKeys) {
        const userId = userKey.replace('users-', '');
        const pteroUserId = await this.db.get(userKey);
        if (!pteroUserId) continue;
        const servers = await this.getUserServers(pteroUserId);
        
        if (!servers) continue;

        for (const server of servers) {
          const stats = await this.getServerStats(server.attributes.identifier);
          
          if (stats) {
            const serverData = {
              serverId: server.attributes.id,
              identifier: server.attributes.identifier,
              name: server.attributes.name,
              userId: userId,
              status: stats.current_state || 'offline',
              resources: stats.resources || {},
              timestamp: Date.now()
            };

            this.serverStats.set(server.attributes.identifier, serverData);
            this.io.to(`server-${server.attributes.identifier}`).emit('server-stats', serverData);
            this.io.to('dashboard').emit('server-update', serverData);
          }
        }
      }
    } catch (error) {
      console.error(chalk.red('[STATS] Error polling servers:'), error.message);
    }
  }

  async getAllUserKeys() {
    try {
      const keys = [];
      return keys;
    } catch (error) {
      return [];
    }
  }

  async getUserServers(pteroUserId) {
    try {
      const response = await fetch(
        `${this.settings.pterodactyl.domain}/api/application/users/${pteroUserId}?include=servers`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.settings.pterodactyl.key}`,
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) return null;
      
      const data = await response.json();
      return data.attributes?.relationships?.servers?.data || [];
    } catch (error) {
      console.error(chalk.red('[STATS] Error fetching user servers:'), error.message);
      return null;
    }
  }

  async getServerStats(identifier) {
    try {
      const response = await fetch(
        `${this.settings.pterodactyl.domain}/api/client/servers/${identifier}/resources`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.settings.pterodactyl.account_key}`,
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) return null;
      
      const data = await response.json();
      return data.attributes || null;
    } catch (error) {
      return null;
    }
  }

  getServerStatsSnapshot(identifier) {
    return this.serverStats.get(identifier);
  }

  getAllServersSnapshot() {
    return Array.from(this.serverStats.values());
  }

  async getServerHistory(identifier, duration = 3600000) { // 1 hour default
    return [this.serverStats.get(identifier)];
  }
}

module.exports = StatsService;
