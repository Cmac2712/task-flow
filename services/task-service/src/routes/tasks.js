const express = require("express");
const Joi = require("joi");
const Task = require("../models/Task");
const { publishTaskEvent } = require("../config/rabbitmq");

const router = express.Router();

// Validation schemas
const createTaskSchema = Joi.object({
  title: Joi.string().min(1).max(200).required(),
  description: Joi.string().max(2000).allow(""),
  priority: Joi.string()
    .valid("low", "medium", "high", "urgent")
    .default("medium"),
  assignedTo: Joi.object({
    userId: Joi.string(),
    email: Joi.string().email(),
    name: Joi.string(),
  }).allow(null),
  project: Joi.string().default("default"),
  tags: Joi.array().items(Joi.string()),
  dueDate: Joi.date().allow(null),
  estimatedHours: Joi.number().min(0).allow(null),
});

const updateTaskSchema = Joi.object({
  title: Joi.string().min(1).max(200),
  description: Joi.string().max(2000).allow(""),
  status: Joi.string().valid("todo", "in_progress", "done", "cancelled"),
  priority: Joi.string().valid("low", "medium", "high", "urgent"),
  assignedTo: Joi.object({
    userId: Joi.string(),
    email: Joi.string().email(),
    name: Joi.string(),
  }).allow(null),
  project: Joi.string(),
  tags: Joi.array().items(Joi.string()),
  dueDate: Joi.date().allow(null),
  estimatedHours: Joi.number().min(0).allow(null),
  actualHours: Joi.number().min(0),
});

// Get all tasks with filtering and pagination
router.get("/", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      priority,
      assignedTo,
      project,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build query
    let query = {};

    // Role-based filtering
    if (req.user.role === "team_member") {
      query = {
        $or: [
          { "assignedTo.userId": req.user.id },
          { "createdBy.userId": req.user.id },
          { "watchers.userId": req.user.id },
        ],
      };
    }

    // Apply filters
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (assignedTo) query["assignedTo.userId"] = assignedTo;
    if (project) query.project = project;

    // Search functionality
    if (search) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { title: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
          { tags: { $in: [new RegExp(search, "i")] } },
        ],
      });
    }

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Execute query
    const tasks = await Task.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum)
      .lean();

    const total = await Task.countDocuments(query);

    res.json({
      tasks,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error("Get tasks error:", err);
    res.status(500).json({
      error: "Unable to fetch tasks",
    });
  }
});

// Get task by ID
router.get("/:id", async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        error: "Task not found",
      });
    }

    // Check if user can view this task
    if (!task.canView(req.user)) {
      return res.status(403).json({
        error: "Insufficient permissions to view this task",
      });
    }

    res.json({ task });
  } catch (err) {
    console.error("Get task error:", err);
    res.status(500).json({
      error: "Unable to fetch task",
    });
  }
});

router.post("/", async (req, res) => {
  try {
    const { error, value } = createTaskSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.details[0].message,
      });
    }

    const taskData = {
      ...value,
      createdBy: {
        userId: req.user.id,
        email: req.user.email,
        name:
          `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim() ||
          req.user.email,
      },
    };

    const task = new Task(taskData);
    await task.save();

    // Publish task creation event
    await publishTaskEvent("created", task, req.user.id);

    res.status(201).json({
      message: "Task created successfully",
      task,
    });
  } catch (err) {
    console.error("Create task error:", err);
    res.status(500).json({
      error: "Unable to create task",
    });
  }
});

// Update task
router.put("/:id", async (req, res) => {
  try {
    const { error, value } = updateTaskSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.details[0].message,
      });
    }

    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        error: "Task not found",
      });
    }

    // Check if user can edit this task
    if (!task.canEdit(req.user)) {
      return res.status(403).json({
        error: "Insufficient permissions to edit this task",
      });
    }

    // Store original status for event publishing
    const originalStatus = task.status;

    // Update task fields
    Object.keys(value).forEach((key) => {
      task[key] = value[key];
    });

    await task.save();

    // Publish appropriate events
    if (originalStatus !== task.status) {
      await publishTaskEvent("status_changed", task, req.user.id);
    } else {
      await publishTaskEvent("updated", task, req.user.id);
    }

    res.json({
      message: "Task updated successfully",
      task,
    });
  } catch (err) {
    console.error("Update task error:", err);
    res.status(500).json({
      error: "Unable to update task",
    });
  }
});

// Delete task
router.delete("/:id", async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        error: "Task not found",
      });
    }

    // Only admin or task creator can delete
    if (req.user.role !== "admin" && task.createdBy.userId !== req.user.id) {
      return res.status(403).json({
        error: "Insufficient permissions to delete this task",
      });
    }

    await Task.findByIdAndDelete(req.params.id);

    // Publish task deletion event
    await publishTaskEvent("deleted", task, req.user.id);

    res.json({
      message: "Task deleted successfully",
      deletedTask: {
        id: task._id,
        title: task.title,
      },
    });
  } catch (err) {
    console.error("Delete task error:", err);
    res.status(500).json({
      error: "Unable to delete task",
    });
  }
});

// Add watcher to task
router.post("/:id/watchers", async (req, res) => {
  try {
    const { userId, email, name } = req.body;

    if (!userId || !email) {
      return res.status(400).json({
        error: "userId and email are required",
      });
    }

    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        error: "Task not found",
      });
    }

    await task.addWatcher({ userId, email, name });

    res.json({
      message: "Watcher added successfully",
      task,
    });
  } catch (err) {
    console.error("Add watcher error:", err);
    res.status(500).json({
      error: "Unable to add watcher",
    });
  }
});

// Remove watcher from task
router.delete("/:id/watchers/:userId", async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        error: "Task not found",
      });
    }

    await task.removeWatcher(req.params.userId);

    res.json({
      message: "Watcher removed successfully",
      task,
    });
  } catch (err) {
    console.error("Remove watcher error:", err);
    res.status(500).json({
      error: "Unable to remove watcher",
    });
  }
});

// Get tasks by user
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.query;

    // Users can only view their own tasks unless they're admin/manager
    if (req.user.role === "team_member" && userId !== req.user.id) {
      return res.status(403).json({
        error: "Insufficient permissions",
      });
    }

    const tasks = await Task.findByUser(userId, status);

    res.json({ tasks });
  } catch (err) {
    console.error("Get user tasks error:", err);
    res.status(500).json({
      error: "Unable to fetch user tasks",
    });
  }
});

// Get tasks by project
router.get("/project/:project", async (req, res) => {
  try {
    const { project } = req.params;
    const { status } = req.query;

    const tasks = await Task.findByProject(project, status);

    res.json({ tasks });
  } catch (err) {
    console.error("Get project tasks error:", err);
    res.status(500).json({
      error: "Unable to fetch project tasks",
    });
  }
});

// Get overdue tasks
router.get("/status/overdue", async (req, res) => {
  try {
    const tasks = await Task.findOverdue();

    // Filter based on user role
    let filteredTasks = tasks;
    if (req.user.role === "team_member") {
      filteredTasks = tasks.filter((task) => task.canView(req.user));
    }

    res.json({ tasks: filteredTasks });
  } catch (err) {
    console.error("Get overdue tasks error:", err);
    res.status(500).json({
      error: "Unable to fetch overdue tasks",
    });
  }
});

module.exports = router;
