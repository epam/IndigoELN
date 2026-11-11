import { useState } from 'react';
import { expect, fireEvent, userEvent, within } from 'storybook/test';

import { TemplateConstructor } from '@/components/templates/template-constructor';
import { EMPTY_TEMPLATE } from '@/components/templates/template-form';
import { makeTemplateDetails } from '@/mocks/fixtures';

import type { Meta, StoryObj } from '@storybook/react-vite';
import type { TemplateTab } from '@/lib/types/templates.ts';

/** The draft lives in the page; this holds it, and prints it so a story can read what was built. */
function Harness({ initial, showErrors }: { initial: readonly TemplateTab[]; showErrors?: boolean }) {
  const [tabs, setTabs] = useState<TemplateTab[]>([...initial]);
  return (
    <div className="flex flex-col gap-4">
      <TemplateConstructor tabs={tabs} onChange={setTabs} showErrors={showErrors} />
      <output data-testid="built" className="sr-only">
        {JSON.stringify(tabs.map((tab) => [tab.name, tab.components.map((component) => component.type)]))}
      </output>
    </div>
  );
}

const meta = {
  title: 'Templates/TemplateConstructor',
  component: Harness,
  args: { initial: EMPTY_TEMPLATE },
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

const built = (canvas: ReturnType<typeof within>) => JSON.parse(canvas.getByTestId('built').textContent ?? '[]');

/** A new template: one empty tab, and the whole palette. */
export const Empty: Story = {};

/**
 * Clicking a component adds it to the selected tab, and the palette then stops offering it there;
 * a second tab, once selected, is offered everything again.
 */
export const ClickToAdd: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Add Experiment Details to Tab 1' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Add Attachments to Tab 1' }));
    await expect(canvas.queryByRole('button', { name: 'Add Attachments to Tab 1' })).not.toBeInTheDocument();

    // A new tab is selected at once; clicking back into the first selects that again.
    await userEvent.click(canvas.getByRole('button', { name: 'Add Tab' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Add Attachments to Tab 2' }));

    await userEvent.click(canvas.getByRole('heading', { name: 'Tab 1' }));
    await expect(canvas.queryAllByRole('button', { name: /to Tab 1$/ })[0]).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Add Attachments to Tab 1' })).not.toBeInTheDocument();

    await expect(built(canvas)).toEqual([
      ['Tab 1', ['experimentDetails', 'attachments']],
      ['Tab 2', ['attachments']],
    ]);
  },
};

/** Dragging off the palette drops where the line shows — here, above the component hovered. */
export const DragFromPalette: Story = {
  args: { initial: [{ name: 'Tab 1', components: [{ type: 'batches' }] }] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const source = canvas.getByRole('button', { name: 'Add Experiment Details to Tab 1' });
    const target = canvas.getByText('Product Batch Summary').closest('[draggable]')!;
    const box = target.getBoundingClientRect();
    const dataTransfer = new DataTransfer();

    fireEvent.dragStart(source, { dataTransfer });
    fireEvent.dragOver(target, { dataTransfer, clientY: box.top + 2 });
    fireEvent.drop(target, { dataTransfer, clientY: box.top + 2 });
    fireEvent.dragEnd(source, { dataTransfer });

    await expect(built(canvas)).toEqual([['Tab 1', ['experimentDetails', 'batches']]]);
  },
};

/** The grip moves a component with the arrow keys, for whoever does not drag. */
export const ReordersWithKeys: Story = {
  args: { initial: [{ name: 'Tab 1', components: [{ type: 'experimentDetails' }, { type: 'attachments' }] }] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    canvas.getByRole('button', { name: 'Move Experiment Details' }).focus();
    await userEvent.keyboard('{ArrowDown}');
    await expect(built(canvas)).toEqual([['Tab 1', ['attachments', 'experimentDetails']]]);
    await expect(canvas.getByRole('button', { name: 'Move Experiment Details' })).toHaveFocus();
  },
};

/** Once Save has been tried, a tab that cannot be saved says why. */
export const ShowsWhyATabCannotBeSaved: Story = {
  args: { showErrors: true },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByRole('alert')).toHaveTextContent('Add at least one component');
  },
};

/** A saved template: the same tabs, nothing to change, no palette. */
export const ReadOnly: Story = {
  render: () => <TemplateConstructor tabs={makeTemplateDetails().templateTabs} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('region', { name: 'Components' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Add Tab' })).not.toBeInTheDocument();
    await expect(canvas.queryAllByRole('checkbox')).toEqual([]);
    await expect(canvas.getAllByText('(included)')).toHaveLength(3);
  },
};
