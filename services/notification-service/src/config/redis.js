const redis = require('redis');

let client = null;

const connectRedis = async () => {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    client = redis.createClient({
      url: redisUrl,
      retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          console.error('Redis server refused connection');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          console.error('Redis retry time exhausted');
          return new Error('Retry time exhausted');
        }
        if (options.attempt > 10) {
          return undefined;
        }
        return Math.min(options.attempt * 100, 3000);
      }
    });

    client.on('error', (err) => {
      console.error('❌ Redis connection error:', err);
    });

    client.on('connect', () => {
      console.log('✅ Redis connected successfully');
    });

    client.on('reconnecting', () => {
      console.log('🔄 Redis reconnecting...');
    });

    client.on('ready', () => {
      console.log('✅ Redis ready for operations');
    });

    await client.connect();

  } catch (err) {
    console.error('❌ Redis connection failed:', err);
    // Don't exit process, Redis is optional for basic functionality
  }
};

// Store user session data
const storeUserSession = async (userId, socketId, userData) => {
  if (!client) return;
  
  try {
    const sessionKey = `user_session:${userId}`;
    const sessionData = {
      socketId,
      ...userData,
      lastSeen: new Date().toISOString()
    };
    
    await client.setEx(sessionKey, 3600, JSON.stringify(sessionData)); // 1 hour TTL
    
    // Add to online users set
    await client.sAdd('online_users', userId);
    
  } catch (err) {
    console.error('Error storing user session:', err);
  }
};

// Remove user session
const removeUserSession = async (userId) => {
  if (!client) return;
  
  try {
    const sessionKey = `user_session:${userId}`;
    await client.del(sessionKey);
    
    // Remove from online users set
    await client.sRem('online_users', userId);
    
  } catch (err) {
    console.error('Error removing user session:', err);
  }
};

// Get user session
const getUserSession = async (userId) => {
  if (!client) return null;
  
  try {
    const sessionKey = `user_session:${userId}`;
    const sessionData = await client.get(sessionKey);
    
    return sessionData ? JSON.parse(sessionData) : null;
  } catch (err) {
    console.error('Error getting user session:', err);
    return null;
  }
};

// Get all online users
const getOnlineUsers = async () => {
  if (!client) return [];
  
  try {
    const userIds = await client.sMembers('online_users');
    const sessions = [];
    
    for (const userId of userIds) {
      const session = await getUserSession(userId);
      if (session) {
        sessions.push({
          userId,
          ...session
        });
      }
    }
    
    return sessions;
  } catch (err) {
    console.error('Error getting online users:', err);
    return [];
  }
};

// Store notification for offline user
const storeOfflineNotification = async (userId, notification) => {
  if (!client) return;
  
  try {
    const notificationKey = `notifications:${userId}`;
    const notificationData = {
      ...notification,
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      stored: true
    };
    
    await client.lPush(notificationKey, JSON.stringify(notificationData));
    
    // Keep only last 50 notifications per user
    await client.lTrim(notificationKey, 0, 49);
    
    // Set expiry for notification list (7 days)
    await client.expire(notificationKey, 7 * 24 * 60 * 60);
    
  } catch (err) {
    console.error('Error storing offline notification:', err);
  }
};

// Get offline notifications for user
const getOfflineNotifications = async (userId) => {
  if (!client) return [];
  
  try {
    const notificationKey = `notifications:${userId}`;
    const notifications = await client.lRange(notificationKey, 0, -1);
    
    return notifications.map(n => JSON.parse(n));
  } catch (err) {
    console.error('Error getting offline notifications:', err);
    return [];
  }
};

// Clear offline notifications for user
const clearOfflineNotifications = async (userId) => {
  if (!client) return;
  
  try {
    const notificationKey = `notifications:${userId}`;
    await client.del(notificationKey);
  } catch (err) {
    console.error('Error clearing offline notifications:', err);
  }
};

// Cache task data temporarily
const cacheTaskData = async (taskId, taskData, ttl = 300) => {
  if (!client) return;
  
  try {
    const taskKey = `task:${taskId}`;
    await client.setEx(taskKey, ttl, JSON.stringify(taskData));
  } catch (err) {
    console.error('Error caching task data:', err);
  }
};

// Get cached task data
const getCachedTaskData = async (taskId) => {
  if (!client) return null;
  
  try {
    const taskKey = `task:${taskId}`;
    const taskData = await client.get(taskKey);
    
    return taskData ? JSON.parse(taskData) : null;
  } catch (err) {
    console.error('Error getting cached task data:', err);
    return null;
  }
};

const getClient = () => client;

module.exports = {
  connectRedis,
  storeUserSession,
  removeUserSession,
  getUserSession,
  getOnlineUsers,
  storeOfflineNotification,
  getOfflineNotifications,
  clearOfflineNotifications,
  cacheTaskData,
  getCachedTaskData,
  getClient
};
