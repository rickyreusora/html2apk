const path = require('path');
const express = require('express');
const buildRouter = require('./routes/build');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api', buildRouter);

app.listen(PORT, () => {
  console.log(`HTML2APK server running at http://localhost:${PORT}`);
});
