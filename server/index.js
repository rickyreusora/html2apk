const path = require('path');
const express = require('express');
const buildRouter = require('./routes/build');

const app = express();
const PORT = process.env.PORT || 3000;

// Disable ETag/conditional-GET caching: the build-status endpoint is polled
// repeatedly, and Express would otherwise return 304 Not Modified with an
// empty body whenever the status hasn't changed between polls, which breaks
// res.json() on the client.
app.disable('etag');

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api', buildRouter);

app.listen(PORT, () => {
  console.log(`HTML2APK server running at http://localhost:${PORT}`);
});
