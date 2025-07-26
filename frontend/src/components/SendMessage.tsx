import { useSocket } from "../contexts/SocketContext";
import { useState } from "react";
import { Send, Users, MessageCircle } from "lucide-react";

export const SendMessage = () => {
  const [message, setMessage] = useState("");
  const { sendDirectMessage, onlineUsers } = useSocket();
  const [selectedUser, setSelectedUser] = useState(
    onlineUsers[0]?.userId || ""
  );
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !selectedUser || isSending) return;

    setIsSending(true);
    try {
      await sendDirectMessage(selectedUser, message.trim());
      setMessage("");
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsSending(false);
    }
  };

  const selectedUserEmail =
    onlineUsers.find((user) => user.userId === selectedUser)?.email ||
    "Select user";

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-md mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">Send Message</h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* User Selection */}
        <div className="space-y-2">
          <label
            htmlFor="user-select"
            className="block text-sm font-medium text-gray-700"
          >
            <Users className="w-4 h-4 inline mr-1" />
            Send to:
          </label>
          <div className="relative">
            <select
              id="user-select"
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 appearance-none cursor-pointer"
              required
            >
              <option value="" disabled>
                Select a user...
              </option>
              {onlineUsers.map((user) => (
                <option key={user.userId} value={user.userId}>
                  {user.email} {user.role && `(${user.role})`}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
              <svg
                className="w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </div>
          {onlineUsers.length === 0 && (
            <p className="text-sm text-gray-500 italic">No users online</p>
          )}
        </div>

        {/* Message Input */}
        <div className="space-y-2">
          <label
            htmlFor="message-input"
            className="block text-sm font-medium text-gray-700"
          >
            Message:
          </label>
          <div className="relative">
            <textarea
              id="message-input"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message here..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              required
              disabled={isSending}
            />
            <div className="absolute bottom-2 right-2 text-xs text-gray-400">
              {message.length}/500
            </div>
          </div>
        </div>

        {/* Send Button */}
        <button
          type="submit"
          disabled={
            !message.trim() ||
            !selectedUser ||
            isSending ||
            onlineUsers.length === 0
          }
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
        >
          {isSending ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Sending...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Send Message
            </>
          )}
        </button>

        {/* Preview */}
        {selectedUser && message.trim() && (
          <div className="mt-4 p-3 bg-gray-50 rounded-md border-l-4 border-blue-500">
            <p className="text-sm text-gray-600">
              <span className="font-medium">To:</span> {selectedUserEmail}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              <span className="font-medium">Message:</span> {message.trim()}
            </p>
          </div>
        )}
      </form>
    </div>
  );
};
