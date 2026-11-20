import { expect, userEvent, within } from 'storybook/test';

import { TemplatePreview } from '@/components/templates/template-preview';
import { makeTemplateDetails } from '@/mocks/fixtures';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
  title: 'Templates/TemplatePreview',
  component: TemplatePreview,
  args: { tabs: makeTemplateDetails().templateTabs },
} satisfies Meta<typeof TemplatePreview>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One tab per template tab; the stoichiometry table shows the blocks it was built with. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Experiment Info',
      'Attachments',
      'Summary',
      'Previous Versions',
    ]);
    await expect(canvas.getByRole('heading', { name: 'Stoichiometric Calculation' })).toBeInTheDocument();
    await expect(canvas.getByText('Reaction Products')).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('tab', { name: 'Summary' }));
    await expect(canvas.getByRole('heading', { name: 'Product Batch Summary' })).toBeInTheDocument();
  },
};

/** A tab still being built. */
export const EmptyTab: Story = { args: { tabs: [{ name: 'Tab 1', components: [] }] } };
