const express = require('express');
const jwt = require('jsonwebtoken');
const { User } = require('../models/User');
const router = express.Router();

// Store active SSE connections
const sseConnections = new Map();

// SSE endpoint for real-time updates
router.get('/sse', async (req, res) => {
  try {
    const token = req.query.token;
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(decoded.userId).select('_id name surname profile');
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Store connection
    const connectionId = `${user._id}_${Date.now()}`;
    sseConnections.set(connectionId, {
      res,
      userId: user._id.toString(),
      user
    });

    // Send initial connection event
    res.write(`data: ${JSON.stringify({ type: 'connected', userId: user._id })}\n\n`);

    // Handle client disconnect
    req.on('close', () => {
      sseConnections.delete(connectionId);
    });

  } catch (error) {
    console.error('SSE connection error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
});

// Helper function to send message to specific user
const sendToUser = (userId, event, data) => {
  for (const [connectionId, connection] of sseConnections) {
    if (connection.userId === userId) {
      try {
        connection.res.write(`data: ${JSON.stringify({ type: event, ...data })}\n\n`);
      } catch (error) {
        console.error('Error sending SSE message:', error);
        sseConnections.delete(connectionId);
      }
    }
  }
};

// Helper function to send message to all users
const broadcast = (event, data) => {
  for (const [connectionId, connection] of sseConnections) {
    try {
      connection.res.write(`data: ${JSON.stringify({ type: event, ...data })}\n\n`);
    } catch (error) {
      console.error('Error broadcasting SSE message:', error);
      sseConnections.delete(connectionId);
    }
  }
};

// Export helper functions for use in other parts of the application
module.exports = { router, sendToUser, broadcast };
