'use strict'

/**
 * Module dependencies.
 */

var exec = require('node:child_process').exec;
var express = require('../..');
var path = require('node:path');
var sanitize = require('./sanitize');
var users = require('./users');

var router = express.Router();

var ATTACHMENTS_DIR = path.join(__dirname, 'attachments');

// placeholder database

var nextId = 3;

var notes = {
  1: {
    id: 1,
    title: 'Release checklist',
    body: '<p>Tag the release and update the <b>changelog</b>.</p>',
    ownerId: 1,
    sharedWith: [2],
    attachments: ['checklist.txt'],
    revisions: []
  },
  2: {
    id: 2,
    title: 'Ferret food order',
    body: '<p>Order more kibble.</p>',
    ownerId: 2,
    sharedWith: [],
    attachments: [],
    revisions: []
  }
};

function canAccess(user, note) {
  return note.ownerId === user.id || note.sharedWith.indexOf(user.id) !== -1;
}

function loadNote(req, res, next) {
  var note = notes[req.params.id];
  if (!note) return res.status(404).json({ error: 'note not found' });
  req.note = note;
  next();
}

function requireAccess(req, res, next) {
  if (!canAccess(req.user, req.note)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  next();
}

function summary(note) {
  return { id: note.id, title: note.title, ownerId: note.ownerId };
}

router.use(users.requireLogin);

// list notes owned by or shared with the current user

router.get('/', function (req, res) {
  var visible = Object.values(notes).filter(function (note) {
    return canAccess(req.user, note);
  });
  res.json(visible.map(summary));
});

router.post('/', function (req, res) {
  if (!req.body || !req.body.title) return res.status(400).json({ error: 'title required' });
  var note = {
    id: nextId++,
    title: String(req.body.title),
    body: String(req.body.body || ''),
    ownerId: req.user.id,
    sharedWith: [],
    attachments: [],
    revisions: []
  };
  notes[note.id] = note;
  res.status(201).json(summary(note));
});

// render a note as HTML

router.get('/:id', loadNote, requireAccess, function (req, res) {
  res.send('<!DOCTYPE html><title>' + sanitize.escapeHtml(req.note.title) + '</title>'
    + '<h1>' + sanitize.escapeHtml(req.note.title) + '</h1>'
    + sanitize.sanitizeHtml(req.note.body));
});

router.put('/:id', loadNote, requireAccess, function (req, res) {
  var note = req.note;
  var body = req.body || {};
  note.revisions.push({ title: note.title, body: note.body, savedBy: req.user.id, savedAt: Date.now() });
  if (body.title != null) note.title = String(body.title);
  if (body.body != null) note.body = String(body.body);
  res.json(summary(note));
});

// revisions: collaborators can save and restore snapshots

router.post('/:id/revisions', loadNote, requireAccess, function (req, res) {
  var snapshot = Object.assign({}, req.body, { savedBy: req.user.id, savedAt: Date.now() });
  req.note.revisions.push(snapshot);
  res.status(201).json({ revision: req.note.revisions.length - 1 });
});

router.post('/:id/restore/:rev', loadNote, requireAccess, function (req, res) {
  var snapshot = req.note.revisions[req.params.rev];
  if (!snapshot) return res.status(404).json({ error: 'revision not found' });

  var restored = Object.assign({}, snapshot);
  delete restored.savedBy;
  delete restored.savedAt;
  Object.assign(req.note, restored);

  res.json(summary(req.note));
});

// export a note as a JSON file

router.get('/:id/export', loadNote, function (req, res) {
  var note = req.note;
  res.attachment('note-' + note.id + '.json');
  res.json({ title: note.title, body: note.body, ownerId: note.ownerId });
});

// download an attachment

router.get('/:id/attachments/:name', loadNote, requireAccess, function (req, res, next) {
  var name = req.params.name.replace('../', '');
  res.download(path.join(ATTACHMENTS_DIR, String(req.note.id), name), function (err) {
    if (err) next(err);
  });
});

// bundle attachments into a zip archive

router.get('/:id/zip', loadNote, requireAccess, function (req, res, next) {
  var name = req.query.name || 'note-' + req.note.id;
  exec('zip -r ' + name + '.zip .', { cwd: ATTACHMENTS_DIR }, function (err) {
    if (err) return next(err);
    res.download(path.join(ATTACHMENTS_DIR, name + '.zip'));
  });
});

module.exports = {
  router: router,
  notes: notes
};
