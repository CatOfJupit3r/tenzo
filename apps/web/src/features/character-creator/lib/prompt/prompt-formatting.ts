export function formatBulletList(lines: string[]) {
  return lines.map((line) => `- ${line}`).join('\n');
}
