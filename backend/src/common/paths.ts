import path from 'path';
import { fileURLToPath } from 'url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

/**
 * Works from both `backend/src/common` (tsx) and `backend/dist/common`
 * (compiled): three levels up is the repository root.
 */
export const REPO_ROOT = path.resolve(currentDirectory, '../../..');

export const FRONTEND_DIR = path.join(REPO_ROOT, 'src', 'frontend');

export function resolveFrontendDir(): string {
  const override = process.env.FRONTEND_DIR?.trim();
  return override ? path.resolve(override) : FRONTEND_DIR;
}
