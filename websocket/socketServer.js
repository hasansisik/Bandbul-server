const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { User } = require('../models/User');

class SocketServer {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: [
          process.env.CLIENT_URL || "http://localhost:3000",
          "https://bandbul.vercel.app",
          "http://localhost:3000"
        ],
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['polling', 'websocket'],
      allowEIO3: true
    });
    
    this.connectedUsers = new Map(); // userId -> socketId mapping
    this.setupMiddleware();
    this.setupEventHandlers();
  }

  setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
        
        if (!token) {
          return next(new Error('Authentication error: No token provided'));
        }

        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        const user = await User.findById(decoded.userId).select('_id name surname profile');
        
        if (!user) {
          return next(new Error('Authentication error: User not found'));
        }

        socket.userId = user._id.toString();
        socket.user = user;
        next();
      } catch (error) {
        next(new Error('Authentication error: Invalid token'));
      }
    });
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      
      // Store user connection
      this.connectedUsers.set(socket.userId, socket.id);
      
      // Notify user is online
      this.broadcastUserStatus(socket.userId, true);

      // Handle joining conversation
      socket.on('join_conversation', (conversationId) => {
        socket.join(`conversation_${conversationId}`);
      });

      // Handle leaving conversation
      socket.on('leave_conversation', (conversationId) => {
        socket.leave(`conversation_${conversationId}`);
      });

      // Handle sending messages
      socket.on('send_message', async (data) => {
        try {
          const { conversationId, content, messageId } = data;
          
          // Broadcast message to all users in the conversation
          this.io.to(`conversation_${conversationId}`).emit('new_message', {
            id: messageId,
            conversationId,
            content,
            sender: {
              _id: socket.user._id,
              name: socket.user.name,
              surname: socket.user.surname,
              picture: socket.user.profile?.picture
            },
            timestamp: new Date().toLocaleTimeString('tr-TR', { 
              hour: '2-digit', 
              minute: '2-digit' 
            }),
            isRead: false
          });

          // Notify conversation participants about new message
          this.io.to(`conversation_${conversationId}`).emit('conversation_updated', {
            conversationId,
            lastMessage: content,
            timestamp: new Date()
          });

        } catch (error) {
          console.error('Error handling send_message:', error);
          socket.emit('error', { message: 'Failed to send message' });
        }
      });

      // Handle typing indicators
      socket.on('typing_start', (data) => {
        socket.to(`conversation_${data.conversationId}`).emit('user_typing', {
          userId: socket.userId,
          userName: `${socket.user.name} ${socket.user.surname}`,
          conversationId: data.conversationId
        });
      });

      socket.on('typing_stop', (data) => {
        socket.to(`conversation_${data.conversationId}`).emit('user_stopped_typing', {
          userId: socket.userId,
          conversationId: data.conversationId
        });
      });

      // Handle message read status
      socket.on('mark_as_read', (data) => {
        socket.to(`conversation_${data.conversationId}`).emit('messages_read', {
          conversationId: data.conversationId,
          userId: socket.userId
        });
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        this.connectedUsers.delete(socket.userId);
        this.broadcastUserStatus(socket.userId, false);
      });
    });
  }

  // Broadcast user online/offline status
  broadcastUserStatus(userId, isOnline) {
    this.io.emit('user_status_changed', {
      userId,
      isOnline
    });
  }

  // Send message to specific user
  sendToUser(userId, event, data) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(socketId).emit(event, data);
    }
  }

  // Send message to conversation
  sendToConversation(conversationId, event, data) {
    this.io.to(`conversation_${conversationId}`).emit(event, data);
  }

  // Get online users
  getOnlineUsers() {
    return Array.from(this.connectedUsers.keys());
  }

  // Check if user is online
  isUserOnline(userId) {
    return this.connectedUsers.has(userId);
  }
}

module.exports = SocketServer;
