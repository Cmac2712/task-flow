const {
  storeUserSession,
  removeUserSession,
  getOfflineNotifications,
  clearOfflineNotifications,
} = require("../config/redis");

const registerHandlers = (socket, io) => {
  const user = socket.user;

  // Store user session in Redis
  storeUserSession(user.id, socket.id, {
    email: user.email,
    role: user.role,
    connectedAt: new Date().toISOString(),
  });

  // Send offline notifications when user connects
  socket.on("get:offline_notifications", async () => {
    try {
      const notifications = await getOfflineNotifications(user.id);
      if (notifications.length > 0) {
        socket.emit("notifications:offline", notifications);
      }
    } catch (err) {
      console.error("Error getting offline notifications:", err);
    }
  });

  // Clear offline notifications
  socket.on("clear:offline_notifications", async () => {
    try {
      await clearOfflineNotifications(user.id);
      socket.emit("notifications:cleared");
    } catch (err) {
      console.error("Error clearing offline notifications:", err);
    }
  });

  // Join specific rooms
  socket.on("join:room", (roomName) => {
    if (typeof roomName === "string" && roomName.length < 100) {
      socket.join(roomName);
      socket.emit("room:joined", { room: roomName });
      console.log(`User ${user.email} joined room: ${roomName}`);
    }
  });

  // Leave specific rooms
  socket.on("leave:room", (roomName) => {
    if (typeof roomName === "string") {
      socket.leave(roomName);
      socket.emit("room:left", { room: roomName });
      console.log(`User ${user.email} left room: ${roomName}`);
    }
  });

  // Join task-specific room for real-time updates
  socket.on("join:task", (taskId) => {
    if (typeof taskId === "string" && taskId.length === 24) {
      // MongoDB ObjectId length
      const taskRoom = `task:${taskId}`;
      socket.join(taskRoom);
      socket.emit("task:joined", { taskId });
      console.log(`User ${user.email} joined task room: ${taskId}`);
    }
  });

  // Leave task-specific room
  socket.on("leave:task", (taskId) => {
    if (typeof taskId === "string" && taskId.length === 24) {
      const taskRoom = `task:${taskId}`;
      socket.leave(taskRoom);
      socket.emit("task:left", { taskId });
      console.log(`User ${user.email} left task room: ${taskId}`);
    }
  });

  // Handle typing indicators for task comments
  socket.on("task:typing", (data) => {
    const { taskId, isTyping } = data;
    if (typeof taskId === "string" && taskId.length === 24) {
      socket.to(`task:${taskId}`).emit("task:user_typing", {
        userId: user.id,
        email: user.email,
        taskId,
        isTyping: Boolean(isTyping),
      });
    }
  });

  // Handle user presence updates
  socket.on("user:presence", (status) => {
    if (["online", "away", "busy"].includes(status)) {
      socket.broadcast.emit("user:presence_update", {
        userId: user.id,
        email: user.email,
        status,
      });
    }
  });

  // Get list of online users
  socket.on("get:online_users", () => {
    const onlineUsers = [];
    io.sockets.sockets.forEach((connectedSocket) => {
      if (connectedSocket.user && connectedSocket.id !== socket.id) {
        onlineUsers.push({
          userId: connectedSocket.user.id,
          email: connectedSocket.user.email,
          role: connectedSocket.user.role,
        });
      }
    });

    socket.emit("online_users", onlineUsers);
  });

  // Send direct message to another user
  socket.on("message:direct", (data) => {
    const { recipientId, message, type = "text" } = data;

    console.log("Direct message:", data);

    if (typeof recipientId === "string" && typeof message === "string") {
      const directMessage = {
        from: {
          userId: user.id,
          email: user.email,
        },
        message,
        type,
        timestamp: new Date().toISOString(),
      };

      // Send to recipient
      io.to(`user:${recipientId}`).emit("message:received", directMessage);

      // Send confirmation to sender
      socket.emit("message:sent", {
        recipientId,
        message,
        timestamp: directMessage.timestamp,
      });
    }
  });

  // Handle task activity updates (for real-time collaboration)
  socket.on("task:activity", (data) => {
    const { taskId, activity, metadata } = data;

    if (typeof taskId === "string" && taskId.length === 24) {
      const activityData = {
        userId: user.id,
        email: user.email,
        taskId,
        activity,
        metadata: metadata || {},
        timestamp: new Date().toISOString(),
      };

      // Broadcast to all users watching this task
      socket.to(`task:${taskId}`).emit("task:activity_update", activityData);
    }
  });

  // Handle ping/pong for connection health
  socket.on("ping", () => {
    socket.emit("pong", {
      timestamp: new Date().toISOString(),
      userId: user.id,
    });
  });

  // Handle custom events for extensibility
  socket.on("custom:event", (data) => {
    if (data && typeof data.type === "string") {
      console.log(`Custom event from ${user.email}:`, data);

      // Echo back to sender for confirmation
      socket.emit("custom:event_received", {
        type: data.type,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Cleanup on disconnect
  socket.on("disconnect", async () => {
    try {
      await removeUserSession(user.id);
    } catch (err) {
      console.error("Error removing user session:", err);
    }
  });
};

module.exports = {
  registerHandlers,
};
