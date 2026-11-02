import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test';

import { AddTemplateDialog } from '@/components/templates/add-template-dialog';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
  title: 'Templates/AddTemplateDialog',
  component: AddTemplateDialog,
  args: { open: true, onOpenChange: fn(), existingNames: ['Default', 'Analytical'], onSubmit: fn() },
} satisfies Meta<typeof AddTemplateDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A name is all it asks; Save hands it on, trimmed, for the tabs to be built around it. */
export const HandsTheNameOn: Story = {
  play: async ({ args }) => {
    const dialog = within(await screen.findByRole('dialog', { name: 'Add Template' }));
    await userEvent.type(dialog.getByLabelText(/Template Name/), ' Synthesis ');
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(args.onSubmit).toHaveBeenCalledWith('Synthesis'));
  },
};

/** A taken name is refused as it is typed. */
export const RefusesTakenName: Story = {
  play: async ({ args }) => {
    const dialog = within(await screen.findByRole('dialog', { name: 'Add Template' }));
    await userEvent.type(dialog.getByLabelText(/Template Name/), 'Default');
    await expect(await dialog.findByText("Template 'Default' already exists")).toBeInTheDocument();
    await waitFor(() => expect(dialog.getByRole('button', { name: 'Save' })).toBeDisabled());
    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};
