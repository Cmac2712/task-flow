const jwt = require('jsonwebtoken');

// Socket.IO authentication middleware
const authenticateSocket = (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return next(new Error('Invalid or expired token'));
      }

      // Attach user info to socket
      socket.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role
      };

      next();
    });

  } catch (err) {
    console.error('Socket authentication error:', err);
    next(new Error('Authentication failed'));
  }
};

// Express middleware for HTTP endpoints
const authenticateHttp = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'Access token required'
      });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) {
        return res.status(403).json({
          error: 'Invalid or expired token'
        });
      }

      req.user = user;
      next();
    });

  } catch (err) {
    console.error('HTTP authentication error:', err);
    res.status(500).json({
      error: 'Authentication failed'
    });
  }
};

module.exports = {
  authenticateSocket,
  authenticateHttp
};
