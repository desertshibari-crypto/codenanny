import { deliver as deliverLocal } from './src/delivery-local.js';
import { deliver as deliverGdrive } from './src/delivery-gdrive.js';
import { deliver as deliverFtp } from './src/delivery-ftp.js';
import { deliver as deliverScp } from './src/delivery-scp.js';

const ADAPTERS = {
  local:  { deliver: deliverLocal },
  gdrive: { deliver: deliverGdrive },
  ftp:    { deliver: deliverFtp },
  scp:    { deliver: deliverScp },
};

export function getAdapter(type) {
  const a = ADAPTERS[type];
  if (!a) throw new Error(`codenanny: unknown delivery adapter "${type}". Known: ${Object.keys(ADAPTERS).join(', ')}`);
  return a;
}

export default ADAPTERS;
