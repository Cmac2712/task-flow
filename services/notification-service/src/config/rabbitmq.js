const amqp = require('amqplib');

let connection = null;
let channel = null;

const connectRabbitMQ = async () => {
  try {
    const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://taskflow:taskflow123@localhost:5672';
    
    connection = await amqp.connect(rabbitmqUrl);
    channel = await connection.createChannel();

    // Create exchanges
    await channel.assertExchange('task_events', 'topic', { durable: true });
    await channel.assertExchange('notifications', 'fanout', { durable: true });

    console.log('✅ RabbitMQ connected successfully (Notification Service)');

    // Handle connection events
    connection.on('error', (err) => {
      console.error('❌ RabbitMQ connection error:', err);
    });

    connection.on('close', () => {
      console.warn('⚠️ RabbitMQ connection closed');
    });

  } catch (err) {
    console.error('❌ RabbitMQ connection failed:', err);
    throw err;
  }
};

const startConsumers = async (io) => {
  try {
    if (!channel) {
      throw new Error('RabbitMQ channel not available');
    }

    // Create and bind queue for task events
    const taskQueue = await channel.assertQueue('task_notifications', { durable: true });
    await channel.bindQueue(taskQueue.queue, 'task_events', 'task.*');

    // Consume task events
    await channel.consume(taskQueue.queue, async (msg) => {
      if (msg) {
        try {
          const event = JSON.parse(msg.content.toString());
          await handleTaskEvent(event, io);
          channel.ack(msg);
        } catch (err) {
          console.error('Error processing task event:', err);
          channel.nack(msg, false, false); // Don't requeue
        }
      }
    });

    console.log('✅ RabbitMQ consumers started');

  } catch (err) {
    console.error('❌ Failed to start RabbitMQ consumers:', err);
    throw err;
  }
};

const handleTaskEvent = async (event, io) => {
  const { eventType, task, userId } = event;

  console.log(`📨 Processing task event: ${eventType} for task ${task._id}`);

  let notification = {
    type: 'task_update',
    timestamp: new Date().toISOString(),
    data: {
      taskId: task._id,
      eventType,
      task
    }
  };

  switch (eventType) {
    case 'created':
      notification.title = 'New Task Created';
      notification.message = `Task "${task.title}" has been created`;
      
      // Notify assigned user if different from creator
      if (task.assignedTo?.userId && task.assignedTo.userId !== userId) {
        io.to(`user:${task.assignedTo.userId}`).emit('notification', {
          ...notification,
          message: `You have been assigned a new task: "${task.title}"`
        });
      }

      // Notify project managers and admins
      io.to('role:project_manager').emit('notification', notification);
      io.to('role:admin').emit('notification', notification);
      break;

    case 'updated':
      notification.title = 'Task Updated';
      notification.message = `Task "${task.title}" has been updated`;
      
      // Notify all watchers except the user who made the change
      task.watchers?.forEach(watcher => {
        if (watcher.userId !== userId) {
          io.to(`user:${watcher.userId}`).emit('notification', notification);
        }
      });

      // Notify assigned user if different from updater
      if (task.assignedTo?.userId && task.assignedTo.userId !== userId) {
        io.to(`user:${task.assignedTo.userId}`).emit('notification', notification);
      }
      break;

    case 'status_changed':
      notification.title = 'Task Status Changed';
      notification.message = `Task "${task.title}" status changed to ${task.status}`;
      
      // Notify all watchers except the user who made the change
      task.watchers?.forEach(watcher => {
        if (watcher.userId !== userId) {
          io.to(`user:${watcher.userId}`).emit('notification', notification);
        }
      });

      // Notify task creator if different from updater
      if (task.createdBy?.userId && task.createdBy.userId !== userId) {
        io.to(`user:${task.createdBy.userId}`).emit('notification', notification);
      }

      // Notify assigned user if different from updater
      if (task.assignedTo?.userId && task.assignedTo.userId !== userId) {
        io.to(`user:${task.assignedTo.userId}`).emit('notification', notification);
      }
      break;

    case 'comment_added':
      notification.title = 'New Comment Added';
      notification.message = `New comment on task "${task.title}"`;
      notification.data.comment = task.newComment;
      
      // Notify all watchers except the commenter
      task.watchers?.forEach(watcher => {
        if (watcher.userId !== userId) {
          io.to(`user:${watcher.userId}`).emit('notification', notification);
        }
      });

      // Notify mentioned users
      if (task.newComment?.mentions) {
        task.newComment.mentions.forEach(mention => {
          if (mention.userId !== userId) {
            io.to(`user:${mention.userId}`).emit('notification', {
              ...notification,
              title: 'You were mentioned',
              message: `You were mentioned in a comment on task "${task.title}"`
            });
          }
        });
      }
      break;

    case 'deleted':
      notification.title = 'Task Deleted';
      notification.message = `Task "${task.title}" has been deleted`;
      
      // Notify all watchers except the deleter
      task.watchers?.forEach(watcher => {
        if (watcher.userId !== userId) {
          io.to(`user:${watcher.userId}`).emit('notification', notification);
        }
      });

      // Notify assigned user if different from deleter
      if (task.assignedTo?.userId && task.assignedTo.userId !== userId) {
        io.to(`user:${task.assignedTo.userId}`).emit('notification', notification);
      }
      break;

    default:
      console.log(`Unknown event type: ${eventType}`);
      return;
  }

  // Emit real-time task update to all connected clients
  io.emit('task:update', {
    eventType,
    task,
    userId,
    timestamp: event.timestamp
  });
};

module.exports = {
  connectRabbitMQ,
  startConsumers,
  handleTaskEvent
};
