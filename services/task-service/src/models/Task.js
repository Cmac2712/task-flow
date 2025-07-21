const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 2000
  },
  status: {
    type: String,
    enum: ['todo', 'in_progress', 'done'],
    default: 'todo'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  assignedTo: {
    userId: {
      type: String,
      required: false
    },
    email: {
      type: String,
      required: false
    },
    name: {
      type: String,
      required: false
    }
  },
  createdBy: {
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
  project: {
    type: String,
    default: 'default'
  },
  tags: [{
    type: String,
    trim: true
  }],
  dueDate: {
    type: Date
  },
  estimatedHours: {
    type: Number,
    min: 0
  },
  actualHours: {
    type: Number,
    min: 0,
    default: 0
  },
  attachments: [{
    filename: String,
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    uploadedBy: {
      userId: String,
      email: String
    }
  }],
  watchers: [{
    userId: String,
    email: String,
    name: String
  }],
  completedAt: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for overdue status
taskSchema.virtual('isOverdue').get(function() {
  if (!this.dueDate || this.status === 'done') return false;
  return new Date() > this.dueDate;
});

// Virtual for days until due
taskSchema.virtual('daysUntilDue').get(function() {
  if (!this.dueDate) return null;
  const now = new Date();
  const due = new Date(this.dueDate);
  const diffTime = due - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Indexes for better query performance
taskSchema.index({ 'assignedTo.userId': 1, status: 1 });
taskSchema.index({ 'createdBy.userId': 1 });
taskSchema.index({ status: 1, priority: 1 });
taskSchema.index({ project: 1 });
taskSchema.index({ dueDate: 1 });
taskSchema.index({ createdAt: -1 });

// Pre-save middleware
taskSchema.pre('save', function(next) {
  // Set completedAt when status changes to done
  if (this.isModified('status')) {
    if (this.status === 'done' && !this.completedAt) {
      this.completedAt = new Date();
    } else if (this.status !== 'done') {
      this.completedAt = undefined;
    }
  }
  next();
});

// Static methods
taskSchema.statics.findByUser = function(userId, status = null) {
  const query = {
    $or: [
      { 'assignedTo.userId': userId },
      { 'createdBy.userId': userId },
      { 'watchers.userId': userId }
    ]
  };
  
  if (status) {
    query.status = status;
  }
  
  return this.find(query).sort({ createdAt: -1 });
};

taskSchema.statics.findByProject = function(project, status = null) {
  const query = { project };
  
  if (status) {
    query.status = status;
  }
  
  return this.find(query).sort({ priority: -1, createdAt: -1 });
};

taskSchema.statics.findOverdue = function() {
  return this.find({
    dueDate: { $lt: new Date() },
    status: { $ne: 'done' }
  }).sort({ dueDate: 1 });
};

// Instance methods
taskSchema.methods.addWatcher = function(user) {
  const isWatching = this.watchers.some(w => w.userId === user.userId);
  if (!isWatching) {
    this.watchers.push({
      userId: user.userId,
      email: user.email,
      name: user.name
    });
  }
  return this.save();
};

taskSchema.methods.removeWatcher = function(userId) {
  this.watchers = this.watchers.filter(w => w.userId !== userId);
  return this.save();
};

taskSchema.methods.canEdit = function(user) {
  // Admin can edit any task
  if (user.role === 'admin') return true;
  
  // Project managers can edit tasks in their projects
  if (user.role === 'project_manager') return true;
  
  // Users can edit tasks they created or are assigned to
  return this.createdBy.userId === user.id || this.assignedTo.userId === user.id;
};

taskSchema.methods.canView = function(user) {
  // Admin can view any task
  if (user.role === 'admin') return true;
  
  // Project managers can view tasks in their projects
  if (user.role === 'project_manager') return true;
  
  // Users can view tasks they're involved with
  return this.createdBy.userId === user.id || 
         this.assignedTo.userId === user.id || 
         this.watchers.some(w => w.userId === user.id);
};

module.exports = mongoose.model('Task', taskSchema);
