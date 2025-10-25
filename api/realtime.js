const settings = require("../settings.json");
const chalk = require('chalk');
const fetch = require('node-fetch');

module.exports.load = async function(app, db) {
  const indexjs = require("../index.js");
  const io = indexjs.io;
  const statsService = indexjs.statsService;

  if (!io || !statsService) {
    console.error(chalk.red('[REALTIME] Socket.io or StatsService not initialized'));
    return;
  }
  io.use(async (socket, next) => {
    const sessionId = socket.handshake.auth.sessionId;
    const userId = socket.handshake.auth.userId;
    if (!userId || !sessionId) {
      return next(new Error('Authentication required'));
    }
    const userExists = await db.get(`users-${userId}`);
    if (!userExists) {
      return next(new Error('Invalid user'));
    }

    socket.userId = userId;
    socket.pteroUserId = userExists;
    next();
  });
  io.on('connection', (socket) => {
    console.log(chalk.cyan(`[REALTIME] User ${socket.userId} connected`));
    socket.join(`user-${socket.userId}`);
    socket.on('subscribe-dashboard', async () => {
      socket.join('dashboard');
      const allServers = statsService.getAllServersSnapshot();
      socket.emit('dashboard-init', allServers);
      
      console.log(chalk.green(`[REALTIME] User ${socket.userId} subscribed to dashboard`));
    });
    socket.on('subscribe-server', async (data) => {
      const { identifier } = data;
      
      if (!identifier) {
        socket.emit('error', { message: 'Server identifier required' });
        return;
      }
      const hasAccess = await verifyServerAccess(socket.pteroUserId, identifier);
      if (!hasAccess) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }
      socket.join(`server-${identifier}`);
      const serverData = statsService.getServerStatsSnapshot(identifier);
      if (serverData) {
        socket.emit('server-init', serverData);
      }

      console.log(chalk.green(`[REALTIME] User ${socket.userId} subscribed to server ${identifier}`));
    });
    socket.on('subscribe-console', async (data) => {
      const { identifier } = data;
      
      if (!identifier) {
        socket.emit('error', { message: 'Server identifier required' });
        return;
      }
      const hasAccess = await verifyServerAccess(socket.pteroUserId, identifier);
      if (!hasAccess) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }
      const wsUrl = await getServerWebSocketUrl(identifier);
      if (wsUrl) {
        connectToServerConsole(socket, identifier, wsUrl);
      } else {
        socket.emit('error', { message: 'Could not connect to server console' });
      }
    });
    socket.on('unsubscribe-dashboard', () => {
      socket.leave('dashboard');
      console.log(chalk.yellow(`[REALTIME] User ${socket.userId} unsubscribed from dashboard`));
    });

    socket.on('unsubscribe-server', (data) => {
      const { identifier } = data;
      socket.leave(`server-${identifier}`);
      console.log(chalk.yellow(`[REALTIME] User ${socket.userId} unsubscribed from server ${identifier}`));
    });
    socket.on('disconnect', () => {
      console.log(chalk.yellow(`[REALTIME] User ${socket.userId} disconnected`));
    });
    socket.on('request-stats-history', async (data) => {
      const { identifier, duration } = data;
      
      const hasAccess = await verifyServerAccess(socket.pteroUserId, identifier);
      if (!hasAccess) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }

      const history = await statsService.getServerHistory(identifier, duration);
      socket.emit('stats-history', { identifier, history });
    });
  });
  async function verifyServerAccess(pteroUserId, identifier) {
    try {
      const response = await fetch(
        `${settings.pterodactyl.domain}/api/client/servers/${identifier}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.pterodactyl.account_key}`,
            'Accept': 'application/json'
          }
        }
      );

      return response.ok;
    } catch (error) {
      return false;
    }
  }
  async function getServerWebSocketUrl(identifier) {
    try {
      const response = await fetch(
        `${settings.pterodactyl.domain}/api/client/servers/${identifier}/websocket`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.pterodactyl.account_key}`,
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) return null;
      
      const data = await response.json();
      return data.data;
    } catch (error) {
      return null;
    }
  }
  function connectToServerConsole(clientSocket, identifier, wsData) {
    const WebSocket = require('ws');
    const ws = new WebSocket(wsData.socket);

    ws.on('open', () => {
      ws.send(JSON.stringify({
        event: 'auth',
        args: [wsData.token]
      }));
      ws.send(JSON.stringify({
        event: 'send logs',
        args: [null]
      }));

      console.log(chalk.green(`[REALTIME] Console connected for server ${identifier}`));
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        if (message.event === 'console output') {
          clientSocket.emit('console-output', {
            identifier,
            output: message.args[0]
          });
        }
        if (message.event === 'status') {
          clientSocket.emit('console-status', {
            identifier,
            status: message.args[0]
          });
        }
      } catch (error) {
        console.error(chalk.red('[REALTIME] Error parsing console message:'), error);
      }
    });

    ws.on('error', (error) => {
      console.error(chalk.red(`[REALTIME] Console WebSocket error for ${identifier}:`), error);
      clientSocket.emit('console-error', { 
        identifier, 
        message: 'Console connection error' 
      });
    });
    ws.on('close', () => {
      console.log(chalk.yellow(`[REALTIME] Console disconnected for server ${identifier}`));
      clientSocket.emit('console-disconnected', { identifier });
    });
    clientSocket.on('disconnect', () => {
      ws.close();
    });
    clientSocket.consoleWs = ws;
  }
};
