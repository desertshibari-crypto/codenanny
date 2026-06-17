export async function deliver(bundle, opts) {
  // v0.2: FTP upload using `basic-ftp`.
  // Flow: connect, ensureDir(destPath), upload index.html + index.json.
  throw new Error(
    'codenanny: FTP adapter is not implemented in v0.1. ' +
    'Workaround: --dest <local-dir>, then upload via your FTP client.'
  );
}
