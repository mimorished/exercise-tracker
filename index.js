const express = require('express');
const app = express();

const cors = require('cors');
const bodyParser = require('body-parser');
const { check, validationResult } = require('express-validator');
const fs = require('fs');
const uuid = require('uuid');

require('dotenv').config();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());
app.use(express.static('public'));
app.use(express.static('views'));


const filePath = './public/data.json';

if (!fs.existsSync(filePath)) {
  fs.writeFileSync(filePath, '[]');
}

function dataManagement(action, input) {
  let file = fs.readFileSync(filePath, 'utf8');
  let data = JSON.parse(file);

  if (action === 'save data' && input) {
    let existingUser = data.find(user => user._id === input._id);
    if (!existingUser) {
      data.push(input);
    } else {
      data = data.map(user => (user._id === input._id ? input : user));
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } else if (action === 'load data') {
    return data;
  }
}

function gen_id(username) {
  let Alldata = dataManagement('load data');
  let id = uuid.v4().replace(/-/g, '').slice(0, 24);

  while (Alldata.some(user => user._id === id)) {
    id = uuid.v4().replace(/-/g, '').slice(0, 24);
  }

  return id;
}

app.post('/api/users',
  [check('username').notEmpty().withMessage('Username is required')],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    const { username } = req.body;
    const id = gen_id(username);

    if (!id) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const newUser = { _id: id, username: username, count: 0, log: [] };
    dataManagement('save data', newUser);

    res.json({ username: newUser.username, _id: newUser._id });
  }
);
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

app.get('/api/users', (req, res) => {
  const Alldata = dataManagement('load data');
  if (!Alldata || Alldata.length === 0) {
    return res.json({ data: 'no data' });
  }
  const users = Alldata.map(user => ({ username: user.username, _id: user._id }));
  res.json(users);
});

app.post('/api/users/:_id/exercises',
  [
    check('description').notEmpty().withMessage('Description is required'),
    check('duration').isNumeric().withMessage('Duration should be a number').notEmpty().withMessage('Duration is required'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    const { description, duration, date } = req.body;
    let { _id } = req.params;

    const Alldata = dataManagement('load data');
    const user = Alldata.find(u => u._id === _id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const logEntry = {
      description: description,
      duration: parseInt(duration),
      date: date ? new Date(date).toDateString() : new Date().toDateString()
    };

    user.log.push(logEntry);
    user.count++;
    dataManagement('save data', user);

    res.json({
      _id: user._id,
      username: user.username,
      date: logEntry.date,
      duration: logEntry.duration,
      description: logEntry.description
    });
  }
);

app.get('/api/users/:_id/logs', (req, res) => {
  const { _id } = req.params;
  const Alldata = dataManagement('load data');
  const user = Alldata.find(u => u._id === _id);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  let { from, to, limit } = req.query;
  let logs = [...user.log];

  if (from) {
    logs = logs.filter(entry => new Date(entry.date) >= new Date(from));
  }
  if (to) {
    logs = logs.filter(entry => new Date(entry.date) <= new Date(to));
  }
  if (limit) {
    logs = logs.slice(0, limit);
  }

  res.json({
    _id: user._id,
    username: user.username,
    count: user.count,
    log: logs
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
