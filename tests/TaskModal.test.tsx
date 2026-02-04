import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskModal } from '../src/components/Board/TaskModal';
import { useStore } from '../src/store';

const resetStore = () => {
  useStore.setState({
    theme: 'dark',
    agents: [{ id: 'agent1', name: 'Agent 1' }],
    agentStatuses: {},
    tasks: [],
    selectedAgentId: null,
    selectedTaskId: null,
    filterPipeline: 'all',
    filterAgent: 'all',
    sidebarCollapsed: false,
    panelCollapsed: true,
    wsConnected: false,
    openclawPath: null,
  });
};

describe('TaskModal', () => {
  beforeEach(() => {
    resetStore();
  });

  it('submits trimmed fields and tags', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();

    render(
      <TaskModal
        isOpen={true}
        onClose={onClose}
        onSave={onSave}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Task title'), {
      target: { value: '  Hello  ' },
    });
    fireEvent.change(screen.getByPlaceholderText('Comma-separated tags'), {
      target: { value: 'a, b,  ,c' },
    });
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[3], { target: { value: 'agent1' } });

    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const payload = onSave.mock.calls[0][0];
    expect(payload.title).toBe('Hello');
    expect(payload.tags).toEqual(['a', 'b', 'c']);
    expect(payload.assignedTo).toBe('agent1');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
