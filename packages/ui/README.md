# @codenanny/ui

Web UI for codenanny — sessions list, transcript viewer, file viewer, search. Vanilla HTML/CSS/JS, no framework.

```js
import { publicDir } from '@codenanny/ui';
import express from 'express';

app.use('/', express.static(publicDir));
```

The UI talks to the codenanny HTTP API at `/codenanny/api/*`. If you mount codenanny on a different path, update `BASE` in `public/app.js`.
