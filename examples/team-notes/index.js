'use strict'

/**
 * Module dependencies.
 */

var express = require('../..');
var session = require('express-session');
var notes = require('./notes');
var sanitize = require('./sanitize');
var users = require('./users');

var app = module.exports = express();

// middleware

app.use(express.json());
app.use(express.urlencoded());
app.use(session({
  resave: false, // don't save session if unmodified
  saveUninitialized: false, // don't create session until something stored
  secret: 'team notes secret'
}));

// simple per-IP rate limit: 100 requests per minute

var WINDOW_MS = 60 * 1000;
var LIMIT = 100;
var hits = new Map();

// drop expired windows so the map only holds recently seen IPs
setInterval(function () {
  var now = Date.now();
  hits.forEach(function (entry, ip) {
    if (now - entry.start > WINDOW_MS) hits.delete(ip);
  });
}, WINDOW_MS).unref();

app.use(function rateLimit(req, res, next) {
  var now = Date.now();
  var entry = hits.get(req.ip);
  if (!entry || now - entry.start > WINDOW_MS) {
    entry = { start: now, count: 0 };
    hits.set(req.ip, entry);
  }

  if (++entry.count > LIMIT) {
    return res.status(429).json({ error: 'too many requests' });
  }

  next();
});

// login / logout

app.post('/login', function (req, res) {
  var user = req.body && users.findByName(req.body.name);
  if (!user || user.password !== req.body.password) {
    return res.status(401).json({ error: 'invalid credentials' });
  }

  req.session.regenerate(function (err) {
    if (err) return res.sendStatus(500);
    req.session.userId = user.id;

    var next = req.query.next;
    if (typeof next === 'string' && next.startsWith('/')) {
      return res.redirect(next);
    }

    res.json(users.publicUser(user));
  });
});

app.post('/logout', function (req, res) {
  req.session.destroy(function () {
    res.sendStatus(204);
  });
});

// home page lists the notes visible to the current user

app.get('/', users.requireLogin, function (req, res) {
  var items = Object.values(notes.notes)
    .filter(function (note) {
      return note.ownerId === req.user.id || note.sharedWith.indexOf(req.user.id) !== -1;
    })
    .map(function (note) {
      return '<li><a href="/notes/' + note.id + '">' + sanitize.escapeHtml(note.title) + '</a></li>';
    });

  res.send('<h1>Notes for ' + sanitize.escapeHtml(req.user.name) + '</h1><ul>' + items.join('') + '</ul>');
});

// user and note APIs

app.use(users.router);
app.use('/notes', notes.router);

// admin tools

app.get('/admin/users', users.requireLogin, users.requireRole('admin'), function (req, res) {
  res.json(Object.values(users.users).map(users.publicUser));
});

app.post('/admin/users/:id/role', users.requireLogin, users.requireRole('admin'), function (req, res) {
  var user = users.users[req.params.id];
  if (!user) return res.status(404).json({ error: 'user not found' });
  if (!req.body || !req.body.role) return res.status(400).json({ error: 'role required' });
  user.role = String(req.body.role);
  res.json(users.publicUser(user));
});

app.delete('/admin/users/:id', users.requireLogin, function (req, res) {
  var user = users.users[req.params.id];
  if (!user) return res.status(404).json({ error: 'user not found' });
  delete users.users[req.params.id];
  res.sendStatus(204);
});

/* istanbul ignore next */
if (!module.parent) {
  app.listen(3000);
  console.log('Express started on port 3000');
}
