import { execFileSync } from 'node:child_process';
import type { Plugin } from 'vite';

export function buildMetadataPlugin(): Plugin {
  return {
    name: 'build-metadata',
    apply: 'build',
    transformIndexHtml(html) {
      const commit = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
        encoding: 'utf8',
      }).trim();

      if (!/^[0-9a-f]{7}$/.test(commit)) {
        throw new Error(`Unexpected Git commit ID: ${commit}`);
      }

      const buildTime = `${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC`;
      const bodyTag = /<body(\s[^>]*)?>/;

      if (!bodyTag.test(html)) {
        throw new Error('Unable to add build metadata: <body> tag not found');
      }

      return html.replace(
        bodyTag,
        (tag) => `${tag.slice(0, -1)} data-commit="${commit}" data-build-time="${buildTime}">`,
      );
    },
  };
}
