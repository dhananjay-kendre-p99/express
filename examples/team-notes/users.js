'use strict'

/**
 * Module dependencies.
 */

var crypto = require('node:crypto');
var express = require('../..');

var router = express.Router();

// placeholder database

var users = {
  1: { id: 1, name: 'ada', email: 'ada@example.com', role: 'admin', password: 'lovelace' },
  2: { id: 2, name: 'tobi', email: 'tobi@example.com', role: 'member', password: 'ferret' },
  3: { id: 3, name: 'loki', email: 'loki@example.com', role: 'member', password: 'ferret' }
};

function findByName(name) {
  return Object.values(users).find(function (user) {
    return user.name === name;
  });
}

/**
 * Require a logged in user.
 */

function requireLogin(req, res, next) {
  var id = req.session.userId;
  if (!id || !users[id]) return res.status(401).json({ error: 'login required' });
  req.user = users[id];
  next();
}

/**
 * Require the logged in user to have `role`.
 */

function requireRole(role) {
  return function (req, res, next) {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: 'forbidden' });
    }
    next();
  };
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

// current user profile

router.get('/me', requireLogin, function (req, res) {
  res.json(publicUser(req.user));
});

// partial profile update, only the fields sent are changed

router.patch('/me', requireLogin, function (req, res) {
  if (!req.body || typeof req.body !== 'object') return res.sendStatus(400);
  Object.assign(req.user, req.body);
  res.json(publicUser(req.user));
});

// password reset: request a token, then use it

router.post('/forgot-password', function (req, res) {
  var user = req.body && findByName(req.body.name);
  if (user) {
    user.resetToken = crypto.randomBytes(24).toString('hex');
    // in a real app the token would be emailed to the user
    if (!module.parent) console.log('reset token for %s: %s', user.name, user.resetToken);
  }
  res.json({ ok: true });
});

router.post('/reset-password', function (req, res) {
  var user = req.body && findByName(req.body.name);
  if (!user) return res.status(404).json({ error: 'unknown user' });

  if (req.body.token == user.resetToken) {
    user.password = String(req.body.password || '');
    user.resetToken = undefined;
    return res.json({ ok: true });
  }

  res.status(400).json({ error: 'invalid token' });
});

module.exports = {
  router: router,
  users: users,
  findByName: findByName,
  requireLogin: requireLogin,
  requireRole: requireRole,
  publicUser: publicUser
};
