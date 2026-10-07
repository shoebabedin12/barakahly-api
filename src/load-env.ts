// Imported first by main.ts: upload destinations and other settings are read
// from process.env while modules load (in decorators), before Nest's
// ConfigModule would get to it, so .env has to be in place by then.
try {
  process.loadEnvFile();
} catch {
  // no .env - rely on the real environment
}
