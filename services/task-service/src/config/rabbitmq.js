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

    // Create queues
    await channel.assertQueue('task_notifications', { durable: true });
    await channel.assertQueue('email_notifications', { durable: true });

    // Bind queues to exchanges
    await channel.bindQueue('task_notifications', 'task_events', 'task.*');
    await channel.bindQueue('email_notifications', 'notifications', '');

    console.log('✅ RabbitMQ connected successfully');

    // Handle connection events
    connection.on('error', (err) => {
      console.error('❌ RabbitMQ connection error:', err);
    });

    connection.on('close', () => {
      console.warn('⚠️ RabbitMQ connection closed');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      if (channel) await channel.close();
      if (connection) await connection.close();
      console.log('RabbitMQ connection closed through app termination');
    });

  } catch (err) {
    console.error('❌ RabbitMQ connection failed:', err);
    throw err;
  }
};

const publishTaskEvent = async (eventType, taskData, userId) => {
  try {
    if (!channel) {
      console.error('RabbitMQ channel not available');
      return;
    }

    const message = {
      eventType,
      task: taskData,
      userId,
      timestamp: new Date().toISOString()
    };

    const routingKey = `task.${eventType}`;
    
    await channel.publish(
      'task_events',
      routingKey,
      Buffer.from(JSON.stringify(message)),
      { persistent: true }
    );

    console.log(`📨 Published task event: ${eventType} for task ${taskData._id}`);
  } catch (err) {
    console.error('Failed to publish task event:', err);
  }
};

const publishNotification = async (notification) => {
  try {
    if (!channel) {
      console.error('RabbitMQ channel not available');
      return;
    }

    const message = {
      ...notification,
      timestamp: new Date().toISOString()
    };

    await channel.publish(
      'notifications',
      '',
      Buffer.from(JSON.stringify(message)),
      { persistent: true }
    );

    console.log(`🔔 Published notification: ${notification.type}`);
  } catch (err) {
    console.error('Failed to publish notification:', err);
  }
};

const getChannel = () => channel;

module.exports = {
  connectRabbitMQ,
  publishTaskEvent,
  publishNotification,
  getChannel
};
