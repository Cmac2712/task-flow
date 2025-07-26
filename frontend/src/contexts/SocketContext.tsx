import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";
import toast from "react-hot-toast";
import { User } from "../types";

interface Notification {
  id: string;
  message: string;
  type: "task_update" | "task_comment" | "task_assignment";
  read?: boolean;
  createdAt: string;
}

interface OnlineUser {
  userId: string;
  email: string;
  status: "online" | "away" | "busy";
}

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  onlineUsers: OnlineUser[];
  notifications: Notification[];
  joinTaskRoom: (taskId: string) => void;
  leaveTaskRoom: (taskId: string) => void;
  sendTypingIndicator: (taskId: string, isTyping: boolean) => void;
  sendDirectMessage: (
    recipientId: string,
    message: string,
    type?: string
  ) => void;
  updatePresence: (status: "online" | "away" | "busy") => void;
  sendTaskActivity: (
    taskId: string,
    activity: string,
    metadata?: Record<string, any>
  ) => void;
  clearNotifications: () => void;
  markNotificationAsRead: (notificationId: string) => void;
  ping: () => void;
}

interface SocketProviderProps {
  children: ReactNode;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const useSocket = (): SocketContextType => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
};

export const SocketProvider = ({ children }: SocketProviderProps) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      const token = localStorage.getItem("token");
      if (token) {
        initializeSocket(token);
      }
    } else {
      disconnectSocket();
    }

    return () => {
      disconnectSocket();
    };
  }, [user]);

  const initializeSocket = (token: string): void => {
    const socketInstance = io(
      import.meta.env.VITE_REACT_APP_NOTIFICATION_SERVICE_URL ||
        "http://localhost:3004",
      {
        auth: {
          token,
        },
        transports: ["websocket", "polling"],
      }
    );

    socketInstance.on("connect", () => {
      console.log("✅ Socket connected");
      setConnected(true);

      // Join user-specific room
      if (user) {
        socketInstance.emit("join:room", `user:${user.id}`);

        // Join role-specific room
        socketInstance.emit("join:room", `role:${user.role}`);
      }

      // Get offline notifications
      socketInstance.emit("get:offline_notifications");

      // Get online users
      socketInstance.emit("get:online_users");
    });

    socketInstance.on("disconnect", () => {
      console.log("❌ Socket disconnected");
      setConnected(false);
    });

    socketInstance.on("connect_error", (error: Error) => {
      console.error("Socket connection error:", error);
      setConnected(false);
    });

    // Handle notifications
    socketInstance.on("notification", (notification: Notification) => {
      setNotifications((prev) => [notification, ...prev.slice(0, 49)]); // Keep last 50

      // Show toast for important notifications
      if (notification.type === "task_update") {
        toast(notification.message, {
          icon: "📋",
          duration: 3000,
        });
      }

      if (notification.type === "task_update") {
        toast(notification.message, {
          icon: "📋",
          duration: 3000,
        });
      }
    });

    // Handle offline notifications
    socketInstance.on(
      "notifications:offline",
      (offlineNotifications: Notification[]) => {
        setNotifications((prev) => [...offlineNotifications, ...prev]);

        if (offlineNotifications.length > 0) {
          toast(`You have ${offlineNotifications.length} new notifications`, {
            icon: "📬",
            duration: 4000,
          });
        }
      }
    );

    // Handle real-time task updates
    socketInstance.on("task:update", (update: any) => {
      // This will be handled by individual components
      console.log("Task update received:", update);
    });

    // Handle online users updates
    socketInstance.on("online_users", (users: OnlineUser[]) => {
      console.log("users", users);
      setOnlineUsers(users);
    });

    // Handle user presence updates
    socketInstance.on(
      "user:presence_update",
      (update: { userId: string; status: "online" | "away" | "busy" }) => {
        setOnlineUsers((prev) =>
          prev.map((user) =>
            user.userId === update.userId
              ? { ...user, status: update.status }
              : user
          )
        );
      }
    );

    // Handle typing indicators
    socketInstance.on("task:user_typing", (data: any) => {
      // This will be handled by TaskDetail component
      console.log("User typing:", data);
    });

    // Handle direct messages
    socketInstance.on(
      "message:received",
      (message: { from: { email: string }; message: string }) => {
        console.log("Message received:", message);
        toast(`Message from ${message.from.email}: ${message.message}`, {
          icon: "💬",
          duration: 5000,
        });
      }
    );

    // Handle room events
    socketInstance.on("room:joined", (data: { room: string }) => {
      console.log(`Joined room: ${data.room}`);
    });

    socketInstance.on("room:left", (data: { room: string }) => {
      console.log(`Left room: ${data.room}`);
    });

    // Handle task room events
    socketInstance.on("task:joined", (data: { taskId: string }) => {
      console.log(`Joined task room: ${data.taskId}`);
    });

    socketInstance.on("task:left", (data: { taskId: string }) => {
      console.log(`Left task room: ${data.taskId}`);
    });

    // Handle ping/pong for connection health
    socketInstance.on("pong", (data: any) => {
      console.log("Pong received:", data);
    });

    socketInstance.on("user:presence_update", (data: { userId: string }) => {
      console.log(`User presence updated: ${data.userId}`);
    });

    setSocket(socketInstance);
  };

  const disconnectSocket = (): void => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setConnected(false);
      setOnlineUsers([]);
      setNotifications([]);
    }
  };

  const joinTaskRoom = (taskId: string): void => {
    if (socket && connected) {
      socket.emit("join:task", taskId);
    }
  };

  const leaveTaskRoom = (taskId: string): void => {
    if (socket && connected) {
      socket.emit("leave:task", taskId);
    }
  };

  const sendTypingIndicator = (taskId: string, isTyping: boolean): void => {
    if (socket && connected) {
      socket.emit("task:typing", { taskId, isTyping });
    }
  };

  const sendDirectMessage = (
    recipientId: string,
    message: string,
    type: string = "text"
  ): void => {
    if (socket && connected) {
      socket.emit("message:direct", { recipientId, message, type });
    }
  };

  const updatePresence = (status: "online" | "away" | "busy"): void => {
    if (socket && connected) {
      socket.emit("user:presence", status);
    }
  };

  const sendTaskActivity = (
    taskId: string,
    activity: string,
    metadata: Record<string, any> = {}
  ): void => {
    if (socket && connected) {
      socket.emit("task:activity", { taskId, activity, metadata });
    }
  };

  const clearNotifications = (): void => {
    setNotifications([]);
    if (socket && connected) {
      socket.emit("clear:offline_notifications");
    }
  };

  const markNotificationAsRead = (notificationId: string): void => {
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === notificationId
          ? { ...notification, read: true }
          : notification
      )
    );
  };

  const ping = (): void => {
    if (socket && connected) {
      socket.emit("ping");
    }
  };

  const value: SocketContextType = {
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
    ping,
  };

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
};
