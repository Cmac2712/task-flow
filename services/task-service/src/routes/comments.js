const express = require('express');
const Joi = require('joi');
const Comment = require('../models/Comment');
const Task = require('../models/Task');
const { publishTaskEvent } = require('../config/rabbitmq');

const router = express.Router();

// Validation schemas
const createCommentSchema = Joi.object({
  taskId: Joi.string().required(),
  content: Joi.string().min(1).max(1000).required(),
  parentComment: Joi.string().allow(null),
  mentions: Joi.array().items(Joi.object({
    userId: Joi.string().required(),
    email: Joi.string().email().required(),
    name: Joi.string().required()
  }))
});

const updateCommentSchema = Joi.object({
  content: Joi.string().min(1).max(1000).required()
});

// Get comments for a task
router.get('/task/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;

    // Verify task exists and user can view it
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({
        error: 'Task not found'
      });
    }

    if (!task.canView(req.user)) {
      return res.status(403).json({
        error: 'Insufficient permissions to view task comments'
      });
    }

    const comments = await Comment.findByTask(taskId);

    res.json({ comments });

  } catch (err) {
    console.error('Get comments error:', err);
    res.status(500).json({
      error: 'Unable to fetch comments'
    });
  }
});

// Create new comment
router.post('/', async (req, res) => {
  try {
    const { error, value } = createCommentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details[0].message
      });
    }

    const { taskId, content, parentComment, mentions } = value;

    // Verify task exists and user can view it
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({
        error: 'Task not found'
      });
    }

    if (!task.canView(req.user)) {
      return res.status(403).json({
        error: 'Insufficient permissions to comment on this task'
      });
    }

    // If it's a reply, verify parent comment exists
    if (parentComment) {
      const parent = await Comment.findById(parentComment);
      if (!parent || parent.taskId.toString() !== taskId) {
        return res.status(400).json({
          error: 'Invalid parent comment'
        });
      }
    }

    const commentData = {
      taskId,
      content,
      author: {
        userId: req.user.id,
        email: req.user.email,
        name: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email
      },
      parentComment: parentComment || null,
      mentions: mentions || []
    };

    const comment = new Comment(commentData);
    await comment.save();

    // If it's a reply, add to parent's replies array
    if (parentComment) {
      const parent = await Comment.findById(parentComment);
      await parent.addReply(comment._id);
    }

    // Add commenter as watcher if not already
    if (!task.watchers.some(w => w.userId === req.user.id)) {
      await task.addWatcher({
        userId: req.user.id,
        email: req.user.email,
        name: commentData.author.name
      });
    }

    // Publish comment event
    await publishTaskEvent('comment_added', {
      ...task.toObject(),
      newComment: comment
    }, req.user.id);

    res.status(201).json({
      message: 'Comment created successfully',
      comment
    });

  } catch (err) {
    console.error('Create comment error:', err);
    res.status(500).json({
      error: 'Unable to create comment'
    });
  }
});

// Update comment
router.put('/:id', async (req, res) => {
  try {
    const { error, value } = updateCommentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details[0].message
      });
    }

    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({
        error: 'Comment not found'
      });
    }

    // Check if user can edit this comment
    if (!comment.canEdit(req.user)) {
      return res.status(403).json({
        error: 'Insufficient permissions to edit this comment'
      });
    }

    comment.content = value.content;
    await comment.save();

    res.json({
      message: 'Comment updated successfully',
      comment
    });

  } catch (err) {
    console.error('Update comment error:', err);
    res.status(500).json({
      error: 'Unable to update comment'
    });
  }
});

// Delete comment
router.delete('/:id', async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({
        error: 'Comment not found'
      });
    }

    // Check if user can delete this comment
    if (!comment.canDelete(req.user)) {
      return res.status(403).json({
        error: 'Insufficient permissions to delete this comment'
      });
    }

    // If comment has replies, delete them too
    if (comment.replies && comment.replies.length > 0) {
      await Comment.deleteMany({ _id: { $in: comment.replies } });
    }

    // If it's a reply, remove from parent's replies array
    if (comment.parentComment) {
      const parent = await Comment.findById(comment.parentComment);
      if (parent) {
        await parent.removeReply(comment._id);
      }
    }

    await Comment.findByIdAndDelete(req.params.id);

    res.json({
      message: 'Comment deleted successfully',
      deletedComment: {
        id: comment._id,
        content: comment.content.substring(0, 50) + '...'
      }
    });

  } catch (err) {
    console.error('Delete comment error:', err);
    res.status(500).json({
      error: 'Unable to delete comment'
    });
  }
});

// Get comment by ID
router.get('/:id', async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id).populate('taskId', 'title');

    if (!comment) {
      return res.status(404).json({
        error: 'Comment not found'
      });
    }

    // Verify user can view the associated task
    const task = await Task.findById(comment.taskId);
    if (!task || !task.canView(req.user)) {
      return res.status(403).json({
        error: 'Insufficient permissions to view this comment'
      });
    }

    res.json({ comment });

  } catch (err) {
    console.error('Get comment error:', err);
    res.status(500).json({
      error: 'Unable to fetch comment'
    });
  }
});

// Get comments by user
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Users can only view their own comments unless they're admin/manager
    if (req.user.role === 'team_member' && userId !== req.user.id) {
      return res.status(403).json({
        error: 'Insufficient permissions'
      });
    }

    const comments = await Comment.findByUser(userId);

    res.json({ comments });

  } catch (err) {
    console.error('Get user comments error:', err);
    res.status(500).json({
      error: 'Unable to fetch user comments'
    });
  }
});

module.exports = router;
