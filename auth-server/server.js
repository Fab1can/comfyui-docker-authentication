const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-key';
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '7d';
const OTP_REGENERATION_INTERVAL = process.env.OTP_REGENERATION_INTERVAL || 30000;
let otp = "00000";

const generateOTP = () => {
  otp = Math.floor(10000 + Math.random() * 90000).toString();
  console.log(`${new Date().toISOString()}: OTP generated: ${otp}`);
}

generateOTP();
setInterval(() => {
    generateOTP();
}, OTP_REGENERATION_INTERVAL);

// Middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());

const tokens = [];

const generateToken = () => {
    const token = jwt.sign({}, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
    tokens.push(token);
    return token;
};

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  if (!tokens.includes(token)) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  next();
};

// Routes

/**
 * POST /login
 * Login endpoint - returns JWT token
 * Body: { _otp: string }
 */
app.get('/login', (req, res) => {
  const _otp = req.query.otp;

  if (!_otp) {
    return res.status(400).json({ error: 'OTP required' });
  }

  if (_otp !== otp) {
    return res.status(401).json({ error: 'Invalid OTP' });
  }

  const token = generateToken();

  // Set JWT token as HTTP-only cookie for NGINX to read
  const maxAgeMs = (() => {
    const exp = (JWT_EXPIRATION || '7d').toString();
    if (exp.endsWith('d')) return parseInt(exp) * 24 * 60 * 60 * 1000;
    if (exp.endsWith('h')) return parseInt(exp) * 60 * 60 * 1000;
    if (exp.endsWith('m')) return parseInt(exp) * 60 * 1000;
    if (!isNaN(parseInt(exp))) return parseInt(exp) * 1000;
    return 7 * 24 * 60 * 60 * 1000;
  })();

  res.cookie('jwt', token, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: maxAgeMs,
  });

  res.json({
    success: true,
    token: token
  });
});

/**
 * POST /logout
 */
app.post('/logout', verifyToken, (req, res) => {
    const token = req.headers.authorization.split(' ')[1];
    const index = tokens.indexOf(token);
    if (index > -1) {
      tokens.splice(index, 1);
    }
    res.clearCookie('jwt');
    res.json({ success: true });
});

/**
 * GET /verify
 * Verify if the provided token is valid
 */
app.get('/verify', verifyToken, (req, res) => {
    const token = req.headers.authorization?.split(' ')[1]; 
    res.json({
        success: true,
        token: token
    });
});

/**
 * GET /refresh
 * Refresh the JWT token (extends expiration)
 */
app.post('/refresh', verifyToken, (req, res) => {
  const newToken = generateToken();
  const maxAgeMs = (() => {
    const exp = (JWT_EXPIRATION || '7d').toString();
    if (exp.endsWith('d')) return parseInt(exp) * 24 * 60 * 60 * 1000;
    if (exp.endsWith('h')) return parseInt(exp) * 60 * 60 * 1000;
    if (exp.endsWith('m')) return parseInt(exp) * 60 * 1000;
    if (!isNaN(parseInt(exp))) return parseInt(exp) * 1000;
    return 7 * 24 * 60 * 60 * 1000;
  })();

  res.cookie('jwt', newToken, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: maxAgeMs,
  });

  res.json({
    success: true,
    token: newToken
  });
});

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Export middleware for use in other files if needed
module.exports = {
  app,
  verifyToken,
  generateToken
};

// Start server
app.listen(PORT, () => {
  console.log(`Auth server running on port ${PORT}`);
});
