/* @vitest-environment node */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/server.js', () => ({
  startServer: vi.fn(),
}));

describe('cli', () => {
  it('starts server with configured port', async () => {
    process.env.PORT = '4567';
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const mod = await import('../bin/cli.js');
    mod.run();

    const { startServer } = await import('../src/server.js');
    expect(startServer).toHaveBeenCalledWith('4567');

    consoleSpy.mockRestore();
    delete process.env.PORT;
  });
});
