const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const {
  createProxyMiddleware,
  fixRequestBody,
} = require("http-proxy-middleware");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();
const PORT = process.env.API_GATEWAY_PORT || 4000;

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGINS?.split(",") || ["http://localhost:3000"],
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});
app.use(limiter);

// Logging
app.use(morgan("combined"));

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// JWT Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }
    req.user = user;
    next();
  });
};

// Role-based authorization middleware
const authorize = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    next();
  };
};

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    services: {
      gateway: "running",
      auth: "http://localhost:4001",
      tasks: "http://localhost:4002",
      notifications: "http://localhost:4003",
    },
  });
});

// Auth service proxy (no auth required for login/register)
app.use(
  "/auth",
  createProxyMiddleware({
    target: `http://localhost:${process.env.AUTH_SERVICE_PORT || 4001}`,
    changeOrigin: true,
    pathRewrite: {
      "^/auth": "",
    },
    // https://www.npmjs.com/package/http-proxy-middleware
    onProxyReq: fixRequestBody,
    onError: (err, req, res) => {
      console.error("Auth service proxy error:", err.message);
      res.status(503).json({ error: "Auth service unavailable" });
    },
  })
);

// Task service proxy (requires authentication)
app.use(
  "/tasks",
  authenticateToken,
  createProxyMiddleware({
    target: `http://localhost:${process.env.TASK_SERVICE_PORT || 4002}`,
    changeOrigin: true,
    // pathRewrite: {
    //   "^/tasks": "",
    // },
    onProxyReq: (proxyReq, req) => {
      proxyReq.setHeader("x-user-id", req.user.id);
      proxyReq.setHeader("x-user-role", req.user.role);
      proxyReq.setHeader("x-user-email", req.user.email);
      fixRequestBody(proxyReq, req);
    },
    onError: (err, req, res) => {
      console.error("Task service proxy error:", err.message);
      res.status(503).json({ error: "Task service unavailable" });
    },
  })
);

// Admin-only routes
app.use(
  "/admin",
  authenticateToken,
  authorize(["admin"]),
  createProxyMiddleware({
    target: `http://localhost:${process.env.AUTH_SERVICE_PORT || 4001}`,
    changeOrigin: true,
    pathRewrite: {
      "^/admin": "/admin",
    },
    onProxyReq: (proxyReq, req) => {
      proxyReq.setHeader("x-user-id", req.user.id);
      proxyReq.setHeader("x-user-role", req.user.role);
    },
    onError: (err, req, res) => {
      console.error("Admin service proxy error:", err.message);
      res.status(503).json({ error: "Admin service unavailable" });
    },
  })
);

// Global error handler
app.use((err, req, res, next) => {
  console.error("Gateway error:", err);
  res.status(500).json({
    error: "Internal server error",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Something went wrong",
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 API Gateway running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
