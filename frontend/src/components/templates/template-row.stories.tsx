import { http, HttpResponse } from 'msw';
import { expect, screen, userEvent, waitFor, within } from 'storybook/test';

import { TemplateRow } from '@/components/templates/template-row';
import { makeTemplate, makeTemplateDetails, TEMPLATES } from '@/mocks/fixtures';
import { handlers } from '@/mocks/handlers';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
  title: 'Templates/TemplateRow',
  component: TemplateRow,
  args: { template: makeTemplate(), existingNames: TEMPLATES.map((template) => template.name) },
} satisfies Meta<typeof TemplateRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The name truncates rather than wrapping, keeping every row the same height. */
export const LongName: Story = {
  args: { template: makeTemplate({ name: 'Palladium-Catalysed Cross-Coupling — Full Stoichiometry and Analytics' }) },
};

/** Rows are meant to be read as a stack — this is what the page looks like. */
export const Stacked: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      {TEMPLATES.map((template) => (
        <TemplateRow key={template.id} template={template} existingNames={args.existingNames} />
      ))}
    </div>
  ),
};

/** The menu holds what the design puts there. */
export const Menu: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Actions for Default' }));
    const items = await screen.findAllByRole('menuitem');
    await expect(items.map((item) => item.textContent)).toEqual(['Preview', 'Rename', 'Delete']);
  },
};

/** Every PATCH body, so the rename story can check what was sent. */
const renamed: unknown[] = [];

/**
 * Rename happens in the row: a taken name is refused as it is typed, and Enter sends a free one.
 */
export const RenamesInPlace: Story = {
  parameters: {
    msw: {
      handlers: [
        http.patch('/api/eln/templates/:id', async ({ request }) => {
          const body = (await request.json()) as { name: string };
          renamed.push(body);
          return HttpResponse.json(makeTemplateDetails({ name: body.name }));
        }),
        ...handlers,
      ],
    },
  },
  play: async ({ canvasElement }) => {
    renamed.length = 0;
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Actions for Default' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Rename' }));

    const input = await canvas.findByRole('textbox', { name: 'Template Name' });
    await userEvent.clear(input);
    await userEvent.type(input, 'Analytical');
    await expect(canvas.getByRole('alert')).toHaveTextContent("Template 'Analytical' already exists");

    await userEvent.clear(input);
    await userEvent.type(input, 'Synthesis{Enter}');
    await waitFor(() => expect(renamed).toEqual([{ name: 'Synthesis' }]));
    await waitFor(() => expect(canvas.queryByRole('textbox')).not.toBeInTheDocument());
  },
};

/** Delete asks first. */
export const AsksBeforeDeleting: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Actions for Default' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete Template' });
    await expect(within(dialog).getByRole('button', { name: 'Delete' })).toBeEnabled();
  },
};

/** Clicking away from a taken name gives the rename up rather than trapping the box open. */
export const LeavingATakenNameGivesUp: Story = {
  parameters: {
    msw: {
      handlers: [
        http.patch('/api/eln/templates/:id', async ({ request }) => {
          renamed.push(await request.json());
          return HttpResponse.json(makeTemplateDetails());
        }),
        ...handlers,
      ],
    },
  },
  play: async ({ canvasElement }) => {
    renamed.length = 0;
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Actions for Default' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Rename' }));

    const input = await canvas.findByRole('textbox', { name: 'Template Name' });
    await userEvent.clear(input);
    await userEvent.type(input, 'Analytical');
    await userEvent.tab();

    await waitFor(() => expect(canvas.queryByRole('textbox')).not.toBeInTheDocument());
    await expect(canvas.getByRole('link', { name: 'Default' })).toBeInTheDocument();
    await expect(renamed).toEqual([]);
  },
};
