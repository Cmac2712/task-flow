const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
require("dotenv").config();

const { connectDatabase } = require("./config/database");
const { connectRabbitMQ } = require("./config/rabbitmq");
const taskRoutes = require("./routes/tasks");
const commentRoutes = require("./routes/comments");

const app = express();
const PORT = process.env.TASK_SERVICE_PORT || 4002;

// Initialize connections
const initializeServices = async () => {
  try {
    await connectDatabase();
    await connectRabbitMQ();
    console.log("✅ All services initialized successfully");
  } catch (err) {
    console.error("❌ Service initialization failed:", err);
    process.exit(1);
  }
};

initializeServices();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan("combined"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Extract user info from headers (set by API Gateway)
app.use((req, res, next) => {
  req.user = {
    id: req.headers["x-user-id"],
    role: req.headers["x-user-role"],
    email: req.headers["x-user-email"],
  };
  next();
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    service: "task-service",
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use("/tasks", taskRoutes);
app.use("/comments", commentRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error("Task service error:", err);
  res.status(500).json({
    error: "Internal server error",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Task operation failed",
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Task endpoint not found",
    path: req.originalUrl,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`📋 Task Service running on port ${PORT}`);
});

module.exports = app;
