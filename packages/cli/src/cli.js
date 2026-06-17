import { startServer } from './serve.js';
import { runIngest } from './ingest-cmd.js';
import { runExport } from './export-cmd.js';
import { startWizard } from './wizard-cmd.js';
import { runResume } from './resume-cmd.js';

const HELP = `
codenanny — turn AI-generated project sprawl into a searchable library.

Usage:
  codenanny <command> [options]

Commands:
  wizard          Launch the HTML setup wizard (default if no command)
  serve           Run the live server (UI + API)
  ingest          One-shot ingest of Claude Code transcripts into the database
  export          Generate a self-contained static HTML+JSON bundle
  resume [id]     Print a paste-ready resume bundle for a session
                    (id defaults to the most recently active session;
                     "latest" is also accepted)
  help            Show this help

Options:
  --db <path>     SQLite database path (default ./codenanny.db)
  --src <path>    Source dir of transcripts (default ~/.claude/projects)
  --port <n>      Port for serve / wizard (default 7700)
  --dest <path>   Destination for export. Schemes:
                    /path           — local directory
                    gdrive://folder — Google Drive folder
                    ftp://host/path — FTP server (stub — coming in v0.2)
                    scp://user@host/path — SCP/SSH
  --config <path> Path to config file (default ./codenanny.config.json)
  --no-config     Skip reading the config file (useful in CI / pure-CLI flows)

Examples:
  codenanny wizard
  codenanny serve --port 7700
  codenanny ingest --src ~/.claude/projects
  codenanny export --dest ./codenanny-export
  codenanny resume                    # most recent session
  codenanny resume latest --copy      # copy to clipboard (OSC52)
  codenanny resume <session-id> --turns 10
`;

export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq !== -1) {
        out[a.slice(2, eq)] = a.slice(eq + 1);
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        out[a.slice(2)] = argv[++i];
      } else {
        out[a.slice(2)] = true;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

export async function run(argv) {
  const args = parseArgs(argv);
  const cmd = args._[0] || 'wizard';
  switch (cmd) {
    case 'serve': return startServer(args);
    case 'ingest': return runIngest(args);
    case 'export': return runExport(args);
    case 'wizard': return startWizard(args);
    case 'resume': return runResume(args);
    case 'help':
    case '--help':
    case '-h':
      console.log(HELP);
      return;
    default:
      console.error(`Unknown command: ${cmd}\n${HELP}`);
      process.exit(2);
  }
}
