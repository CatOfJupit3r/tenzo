export class PromptFormatter {
  formatBulletList(lines: string[]): string {
    return lines.map((line) => `- ${line}`).join('\n');
  }
}
