import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarkdownMessageBody } from '../../src/features/chat/components/MarkdownMessageBody';

describe('MarkdownMessageBody', () => {
  it('renders markdown tables, links, and code blocks', () => {
    render(
      <MarkdownMessageBody
        text={[
          '这里有一个[链接](https://example.com)。',
          '',
          '| 名称 | 说明 |',
          '| --- | --- |',
          '| 表格 | 可滚动 |',
          '',
          '```ts',
          'const answer = 42;',
          '```',
        ].join('\n')}
      />,
    );

    expect(screen.getByRole('link', { name: '链接' }).getAttribute('href')).toBe('https://example.com');
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByText('表格')).toBeTruthy();
    expect(screen.getByText('const answer = 42;')).toBeTruthy();
  });
});
