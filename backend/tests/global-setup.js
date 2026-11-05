import { execSync } from 'node:child_process';
import dotenv from 'dotenv';

export default function setup() {
  dotenv.config({ path: '.env.test', override: true });
  if (!process.env.DATABASE_URL?.includes('recrutement_ia_test')) {
    throw new Error('Refusing to reset: DATABASE_URL is not the test database');
  }
  execSync('npx prisma migrate reset --force --skip-seed', {
    stdio: 'inherit',
    env: process.env,
  });
}