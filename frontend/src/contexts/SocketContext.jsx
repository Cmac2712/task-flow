import { createContext, useContext, useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from './AuthContext'
import toast from 'react-hot-toast'

const SocketContext = createContext()

export const useSocket = () => {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return context
}

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null)
  const [connected, setConnected] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState([])
  const [notifications, setNotifications] = useState([])
  const { user } = useAuth()

  useEffect(() => {
    if (user) {
      const token = localStorage.getItem('token')
      if (token) {
        initializeSocket(token)
      }
    } else {
      disconnectSocket()
    }

    return () => {
      disconnectSocket()
    }
  }, [user])

  const initializeSocket = (token) => {
    const socketInstance = io(process.env.REACT_APP_NOTIFICATION_SERVICE_URL || 'http://localhost:3004', {
      auth: {
        token
      },
      transports: ['websocket', 'polling']
    })

    socketInstance.on('connect', () => {
      console.log('✅ Socket connected')
      setConnected(true)
      
      // Join user-specific room
      socketInstance.emit('join:room', `user:${user.id}`)
      
      // Join role-specific room
      socketInstance.emit('join:room', `role:${user.role}`)
      
      // Get offline notifications
      socketInstance.emit('get:offline_notifications')
      
      // Get online users
      socketInstance.emit('get:online_users')
    })

    socketInstance.on('disconnect', () => {
      console.log('❌ Socket disconnected')
      setConnected(false)
    })

    socketInstance.on('connect_error', (error) => {
      console.error('Socket connection error:', error)
      setConnected(false)
    })

    // Handle notifications
    socketInstance.on('notification', (notification) => {
      setNotifications(prev => [notification, ...prev.slice(0, 49)]) // Keep last 50
      
      // Show toast for important notifications
      if (notification.type === 'task_update') {
        toast(notification.message, {
          icon: '📋',
          duration: 3000
        })
      }
    })

    // Handle offline notifications
    socketInstance.on('notifications:offline', (offlineNotifications) => {
      setNotifications(prev => [...offlineNotifications, ...prev])
      
      if (offlineNotifications.length > 0) {
        toast(`You have ${offlineNotifications.length} new notifications`, {
          icon: '📬',
          duration: 4000
        })
      }
    })

    // Handle real-time task updates
    socketInstance.on('task:update', (update) => {
      // This will be handled by individual components
      console.log('Task update received:', update)
    })

    // Handle online users updates
    socketInstance.on('online_users', (users) => {
      setOnlineUsers(users)
    })

    // Handle user presence updates
    socketInstance.on('user:presence_update', (update) => {
      setOnlineUsers(prev => 
        prev.map(user => 
          user.userId === update.userId 
            ? { ...user, status: update.status }
            : user
        )
      )
    })

    // Handle typing indicators
    socketInstance.on('task:user_typing', (data) => {
      // This will be handled by TaskDetail component
      console.log('User typing:', data)
    })

    // Handle direct messages
    socketInstance.on('message:received', (message) => {
      toast(`Message from ${message.from.email}: ${message.message}`, {
        icon: '💬',
        duration: 5000
      })
    })

    // Handle room events
    socketInstance.on('room:joined', (data) => {
      console.log(`Joined room: ${data.room}`)
    })

    socketInstance.on('room:left', (data) => {
      console.log(`Left room: ${data.room}`)
    })

    // Handle task room events
    socketInstance.on('task:joined', (data) => {
      console.log(`Joined task room: ${data.taskId}`)
    })

    socketInstance.on('task:left', (data) => {
      console.log(`Left task room: ${data.taskId}`)
    })

    // Handle ping/pong for connection health
    socketInstance.on('pong', (data) => {
      console.log('Pong received:', data)
    })

    setSocket(socketInstance)
  }

  const disconnectSocket = () => {
    if (socket) {
      socket.disconnect()
      setSocket(null)
      setConnected(false)
      setOnlineUsers([])
      setNotifications([])
    }
  }

  const joinTaskRoom = (taskId) => {
    if (socket && connected) {
      socket.emit('join:task', taskId)
    }
  }

  const leaveTaskRoom = (taskId) => {
    if (socket && connected) {
      socket.emit('leave:task', taskId)
    }
  }

  const sendTypingIndicator = (taskId, isTyping) => {
    if (socket && connected) {
      socket.emit('task:typing', { taskId, isTyping })
    }
  }

  const sendDirectMessage = (recipientId, message, type = 'text') => {
    if (socket && connected) {
      socket.emit('message:direct', { recipientId, message, type })
    }
  }

  const updatePresence = (status) => {
    if (socket && connected) {
      socket.emit('user:presence', status)
    }
  }

  const sendTaskActivity = (taskId, activity, metadata = {}) => {
    if (socket && connected) {
      socket.emit('task:activity', { taskId, activity, metadata })
    }
  }

  const clearNotifications = () => {
    setNotifications([])
    if (socket && connected) {
      socket.emit('clear:offline_notifications')
    }
  }

  const markNotificationAsRead = (notificationId) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === notificationId 
          ? { ...notification, read: true }
          : notification
      )
    )
  }

  const ping = () => {
    if (socket && connected) {
      socket.emit('ping')
    }
  }

  const value = {
    socket,
    connected,
    onlineUsers,
    notifications,
    joinTaskRoom,
    leaveTaskRoom,
    sendTypingIndicator,
    sendDirectMessage,
    updatePresence,
    sendTaskActivity,
    clearNotifications,
    markNotificationAsRead,
    ping
  }

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  )
}
