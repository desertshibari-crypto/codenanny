# @codenanny/wizard

HTML setup wizard for codenanny. Walks users through:

1. Mode (live server vs. one-shot export)
2. Source directory (Claude Code transcripts)
3. Destination (export mode only)
4. Credentials (remote destinations only)
5. Bundle options (include source files, redact secrets, schedule)
6. Review & start

```js
import { startWizard } from '@codenanny/wizard';
await startWizard({ port: 7700 });
```

Then visit `http://localhost:7700`.

v0.1 saves the configuration to console only. v0.2 will persist and start the runtime in the configured mode.
