# Real-Time Collaborative Task Management Platform

A microservices-based task management platform with real-time collaboration features.

## Architecture

### Microservices
- **API Gateway** - Routes requests and handles load balancing
- **Auth Service** - JWT authentication with RBAC (PostgreSQL)
- **Task Service** - Task CRUD operations (MongoDB)
- **Notification Service** - Real-time updates via Socket.IO + RabbitMQ
- **Frontend** - React application with real-time features

### Tech Stack
- **Backend**: Node.js, Express.js, Socket.IO
- **Databases**: PostgreSQL (users/auth), MongoDB (tasks/comments)
- **Message Queue**: RabbitMQ
- **Frontend**: React, Socket.IO Client
- **Testing**: Jest, Mocha
- **Containerization**: Docker, Docker Compose

## Features

### Core Functionality
- ✅ Create, edit, delete tasks
- ✅ Assign tasks to users
- ✅ Task status updates (todo, in-progress, done)
- ✅ Comments on tasks
- ✅ Due dates and priorities
- ✅ Real-time task updates
- ✅ Role-based access control (Admin, Project Manager, Team Member)

### Real-time Features
- Live task updates when modified by others
- Real-time comments
- User activity notifications

## Quick Start

1. **Prerequisites**
   ```bash
   docker --version
   docker-compose --version
   node --version (v18+)
   ```

2. **Start Services**
   ```bash
   docker-compose up -d
   yarn dev
   ```

3. **Access Application**
   - Frontend: http://localhost:3000
   - API Gateway: http://localhost:4000
   - Auth Service: http://localhost:4001
   - Task Service: http://localhost:4002
   - Notification Service: http://localhost:4003

## Development

### Running Tests
```bash
# Run all tests
npm test

# Run specific service tests
npm run test:auth
npm run test:tasks
npm run test:frontend
```

### Environment Variables
Copy `.env.example` to `.env` and configure your settings.

## API Documentation

### Authentication Endpoints
- `POST /auth/register` - Register new user
- `POST /auth/login` - User login
- `GET /auth/profile` - Get user profile

### Task Endpoints
- `GET /tasks` - Get all tasks
- `POST /tasks` - Create new task
- `PUT /tasks/:id` - Update task
- `DELETE /tasks/:id` - Delete task
- `POST /tasks/:id/comments` - Add comment

### Real-time Events
- `task:created` - New task created
- `task:updated` - Task modified
- `task:deleted` - Task deleted
- `comment:added` - New comment added

## User Roles

- **Admin**: Full system access, user management
- **Project Manager**: Create/manage projects, assign tasks
- **Team Member**: View assigned tasks, update status, add comments

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

MIT License - see LICENSE file for details
