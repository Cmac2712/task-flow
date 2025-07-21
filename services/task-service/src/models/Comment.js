const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  author: {
    userId: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    }
  },
  mentions: [{
    userId: String,
    email: String,
    name: String
  }],
  attachments: [{
    filename: String,
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date
  },
  parentComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment'
  },
  replies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment'
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
commentSchema.index({ taskId: 1, createdAt: -1 });
commentSchema.index({ 'author.userId': 1 });
commentSchema.index({ parentComment: 1 });

// Pre-save middleware
commentSchema.pre('save', function(next) {
  if (this.isModified('content') && !this.isNew) {
    this.isEdited = true;
    this.editedAt = new Date();
  }
  next();
});

// Static methods
commentSchema.statics.findByTask = function(taskId) {
  return this.find({ taskId, parentComment: null })
    .populate('replies')
    .sort({ createdAt: 1 });
};

commentSchema.statics.findByUser = function(userId) {
  return this.find({ 'author.userId': userId })
    .populate('taskId', 'title')
    .sort({ createdAt: -1 });
};

// Instance methods
commentSchema.methods.canEdit = function(user) {
  // Admin can edit any comment
  if (user.role === 'admin') return true;
  
  // Users can edit their own comments within 15 minutes
  if (this.author.userId === user.id) {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    return this.createdAt > fifteenMinutesAgo;
  }
  
  return false;
};

commentSchema.methods.canDelete = function(user) {
  // Admin can delete any comment
  if (user.role === 'admin') return true;
  
  // Project managers can delete comments
  if (user.role === 'project_manager') return true;
  
  // Users can delete their own comments
  return this.author.userId === user.id;
};

commentSchema.methods.addReply = function(replyId) {
  if (!this.replies.includes(replyId)) {
    this.replies.push(replyId);
  }
  return this.save();
};

commentSchema.methods.removeReply = function(replyId) {
  this.replies = this.replies.filter(id => !id.equals(replyId));
  return this.save();
};

module.exports = mongoose.model('Comment', commentSchema);
