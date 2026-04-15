import { execSync } from 'node:child_process';

function run(command) {
  execSync(command, { stdio: 'inherit' });
}

run('npm run build');
run('git add src/content/blog docs public/.nojekyll');

const changes = execSync('git diff --cached --name-only', { encoding: 'utf8' }).trim();
if (!changes) {
  console.log('No staged changes. Nothing to publish.');
  process.exit(0);
}

const message = `deploy: publish site ${new Date().toISOString().slice(0, 10)}`;
run(`git commit -m "${message}"`);
run('git push');
