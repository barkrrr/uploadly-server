'use strict';

const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const ObjectId = require('mongoose').Types.ObjectId;

const uploadCloud = require('../configs/cloudinary.js');

const Document = require('../models/document');
const User = require('../models/user');

router.get('/', (req, res, next) => {
  const currentUser = req.session.currentUser;
  if (!currentUser || currentUser.role !== 'admin') {
    return res.status(401).json({ code: 'unauthorized' });
  }

  User.find({ createdBy: currentUser._id })
    .populate('createdBy')
    .then((users) => {
      res.json(users);
    })
    .catch(next);
});

router.post('/', (req, res, next) => {
  const currentUser = req.session.currentUser;
  if (!currentUser || currentUser.role !== 'admin') {
    return res.status(401).json({ code: 'unauthorized' });
  }

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(422).json({ code: 'validation error' });
  }

  User.findOne({ username }, 'username')
    .then((userExists) => {
      if (userExists) {
        return res.status(409).json({ code: 'conflict' });
      }

      const salt = bcrypt.genSaltSync(10);
      const hashPass = bcrypt.hashSync(password, salt);

      const data = {
        username,
        password: hashPass,
        createdBy: currentUser._id,
        role: 'user'
      };

      const user = new User(data);
      return user.save()
        .then(() => {
          res.json(user);
        });
    })
    .catch(next);
});

router.get('/:id', (req, res, next) => {
  const currentUser = req.session.currentUser;
  if (!currentUser || currentUser.role !== 'admin') {
    return res.status(401).json({ code: 'unauthorized' });
  }
  const id = req.params.id;

  if (!ObjectId.isValid(id)) {
    return next();
  }

  User.findOne({
    $and: [ { createdBy: currentUser._id }, { _id: id } ]
  })
    .then((user) => {
      Document.find({ recipient: user._id })
        .populate('recipient')
        .populate('uploadedBy')
        .then((documents) => {
          res.json(documents);
        });
    })
    .catch(next);
});

router.post('/:id/document/create', uploadCloud.single('file'), (req, res, next) => {
  const currentUser = req.session.currentUser;
  if (!currentUser || currentUser.role !== 'admin') {
    return res.status(401).json({ code: 'unauthorized' });
  }
  const id = req.params.id;

  if (!ObjectId.isValid(id)) {
    return next();
  }
  User.findOne({
    $and: [ { createdBy: currentUser._id }, { _id: id } ]
  });
  const file = req.file.url;
  const salt = bcrypt.genSaltSync(10);
  const hashDoc = bcrypt.hashSync(file, salt);

  const data = {
    recipient: req.body.recipient,
    uploadedBy: req.body.currentUser,
    name: req.body.name,
    description: req.body.description,
    type: req.body.type,
    file: hashDoc
  };

  const document = new Document(data);
  return document.save()
    .then(() => {
      res.json(document);
    })
    .catch(next);
});

module.exports = router;
