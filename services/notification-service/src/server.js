const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const { connectRabbitMQ, startConsumers } = require('./config/rabbitmq');
const { connectRedis } = require('./config/redis');
const { authenticateSocket } = require('./middleware/auth');
const socketHandlers = require('./handlers/socketHandlers');

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with CORS
const io = socketIo(server, {
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

const PORT = process.env.NOTIFICATION_SERVICE_PORT || 4003;

// Initialize services
const initializeServices = async () => {
  try {
    await connectRedis();
    await connectRabbitMQ();
    await startConsumers(io);
    console.log('✅ All notification services initialized successfully');
  } catch (err) {
    console.error('❌ Notification service initialization failed:', err);
    process.exit(1);
  }
};

initializeServices();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    service: 'notification-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    connections: io.engine.clientsCount
  });
});

// Socket.IO authentication middleware
io.use(authenticateSocket);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`👤 User connected: ${socket.user.email} (${socket.id})`);
  
  // Join user to their personal room
  socket.join(`user:${socket.user.id}`);
  
  // Join user to their role-based room
  socket.join(`role:${socket.user.role}`);
  
  // Notify others that user is online
  socket.broadcast.emit('user:online', {
    userId: socket.user.id,
    email: socket.user.email,
    role: socket.user.role
  });

  // Register socket event handlers
  socketHandlers.registerHandlers(socket, io);

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    console.log(`👤 User disconnected: ${socket.user.email} (${reason})`);
    
    // Notify others that user is offline
    socket.broadcast.emit('user:offline', {
      userId: socket.user.id,
      email: socket.user.email
    });
  });

  // Handle errors
  socket.on('error', (error) => {
    console.error(`Socket error for user ${socket.user.email}:`, error);
  });
});

// API endpoints for sending notifications
app.post('/notify/user/:userId', (req, res) => {
  const { userId } = req.params;
  const { type, title, message, data } = req.body;

  if (!type || !title || !message) {
    return res.status(400).json({
      error: 'Missing required fields: type, title, message'
    });
  }

  const notification = {
    type,
    title,
    message,
    data: data || {},
    timestamp: new Date().toISOString()
  };

  // Send to specific user
  io.to(`user:${userId}`).emit('notification', notification);

  res.json({
    success: true,
    message: 'Notification sent',
    recipients: 1
  });
});

app.post('/notify/role/:role', (req, res) => {
  const { role } = req.params;
  const { type, title, message, data } = req.body;

  if (!['admin', 'project_manager', 'team_member'].includes(role)) {
    return res.status(400).json({
      error: 'Invalid role'
    });
  }

  if (!type || !title || !message) {
    return res.status(400).json({
      error: 'Missing required fields: type, title, message'
    });
  }

  const notification = {
    type,
    title,
    message,
    data: data || {},
    timestamp: new Date().toISOString()
  };

  // Send to all users with specific role
  io.to(`role:${role}`).emit('notification', notification);

  res.json({
    success: true,
    message: 'Notification sent to role',
    role
  });
});

app.post('/notify/broadcast', (req, res) => {
  const { type, title, message, data } = req.body;

  if (!type || !title || !message) {
    return res.status(400).json({
      error: 'Missing required fields: type, title, message'
    });
  }

  const notification = {
    type,
    title,
    message,
    data: data || {},
    timestamp: new Date().toISOString()
  };

  // Broadcast to all connected users
  io.emit('notification', notification);

  res.json({
    success: true,
    message: 'Notification broadcast',
    recipients: io.engine.clientsCount
  });
});

// Get connected users
app.get('/users/online', (req, res) => {
  const connectedUsers = [];
  
  io.sockets.sockets.forEach((socket) => {
    if (socket.user) {
      connectedUsers.push({
        userId: socket.user.id,
        email: socket.user.email,
        role: socket.user.role,
        connectedAt: socket.handshake.time
      });
    }
  });

  res.json({
    count: connectedUsers.length,
    users: connectedUsers
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Notification service error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Notification failed'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Notification endpoint not found',
    path: req.originalUrl
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🔔 Notification Service running on port ${PORT}`);
  console.log(`🌐 Socket.IO ready for connections`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down notification service...');
  server.close(() => {
    console.log('Notification service stopped');
    process.exit(0);
  });
});

module.exports = { app, io, server };
