import { useQuery } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';

import { TemplateList } from '@/components/templates/template-list';
import { useFilteredTemplates } from '@/lib/api/templates';
import { handlers, templatesErrorHandlers } from '@/mocks/handlers';

import type { Meta, StoryObj } from '@storybook/react-vite';

/** The list takes its query from the route; this stands in for it. */
function TemplateListHarness() {
  const query = useFilteredTemplates({ search: '', sort: 'LATEST', createdByMe: false });
  return <TemplateList query={query} existingNames={(query.data?.items ?? []).map((item) => item.name)} />;
}

/** A query that never settles, for the first-load skeletons. */
function LoadingHarness() {
  const query = useQuery({ queryKey: ['templates-loading'], queryFn: () => new Promise<never>(() => {}) });
  return <TemplateList query={query} existingNames={[]} />;
}

const meta = {
  title: 'Templates/TemplateList',
  component: TemplateListHarness,
} satisfies Meta<typeof TemplateListHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Loading: Story = { render: () => <LoadingHarness /> };

export const Empty: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/api/eln/templates', () =>
          HttpResponse.json({ pageNo: 0, pageSize: 100, totalItems: 0, totalPages: 0, hasMore: false, items: [] }),
        ),
        ...handlers,
      ],
    },
  },
};

export const Failure: Story = { parameters: { msw: { handlers: templatesErrorHandlers } } };
