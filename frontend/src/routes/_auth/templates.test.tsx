import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeCurrentUser, makeTemplateDetails, TEMPLATES } from '@/mocks/fixtures';

vi.mock('@/lib/auth', () => ({
  auth: { getAccessToken: async () => 'token', requireLogin: async () => false, signOut: vi.fn() },
}));

const apiFetch = vi.fn();
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, apiFetch: (path: string, init?: { method?: string; json?: unknown }) => apiFetch(path, init) };
});

const { routeTree } = await import('@/routeTree.gen');

const [DEFAULT] = TEMPLATES;
const MANAGER = makeCurrentUser({ permissions: ['VIEW_PROJECTS', 'MANAGE_TEMPLATES'] });

let currentUser = MANAGER;

function respond(path: string, init?: { method?: string; json?: unknown }) {
  if (path === '/api/eln/currentUser') return Promise.resolve(currentUser);
  if (path === '/api/eln/templates' && init?.method === 'POST') {
    const body = init.json as { name: string };
    return Promise.resolve(makeTemplateDetails({ id: 'created', name: body.name }));
  }
  if (path.startsWith('/api/eln/templates?')) {
    return Promise.resolve({
      pageNo: 0,
      pageSize: 100,
      totalItems: 3,
      totalPages: 1,
      hasMore: false,
      items: TEMPLATES,
    });
  }
  const detail = path.match(/^\/api\/eln\/templates\/(.+)$/);
  if (detail && init?.method === 'PATCH') {
    return Promise.resolve(makeTemplateDetails({ id: detail[1], name: (init.json as { name: string }).name }));
  }
  if (detail && init?.method === 'DELETE') return Promise.resolve(null);
  if (detail) return Promise.resolve(makeTemplateDetails({ id: detail[1] }));
  return Promise.resolve([]);
}

async function renderAt(initial: string) {
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [initial] }) });
  await router.load();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router as never} />
    </QueryClientProvider>,
  );
  return router;
}

const paths = () => apiFetch.mock.calls.map(([path]) => String(path));

describe('templates routes', () => {
  beforeEach(() => {
    currentUser = MANAGER;
    apiFetch.mockReset();
    apiFetch.mockImplementation(respond);
  });

  /**
   * The exact URLs, asserted here because the fetchers are module-private: the filtered list in one
   * page (the backend's default page is 10), and the whole one every name is checked against.
   */
  it('lists templates as the action bar filters them', async () => {
    await renderAt('/templates?q=acid&sort=EARLIEST&createdByMe=true');

    await waitFor(() =>
      expect(paths()).toContain('/api/eln/templates?sort=EARLIEST&pageSize=100&search=acid&createdByMe=true'),
    );
    expect(paths()).toContain('/api/eln/templates?pageSize=100');
  });

  /** Add Template takes a name; the constructor builds the tabs, and Save posts them together. */
  it('builds a template in the constructor and creates it through POST /templates', async () => {
    const router = await renderAt('/templates');

    await userEvent.click(await screen.findByRole('button', { name: 'Add Template' }));
    await userEvent.type(await screen.findByLabelText(/Template Name/), 'Synthesis');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/templates/new'));
    expect(apiFetch).not.toHaveBeenCalledWith('/api/eln/templates', expect.anything());

    // An empty tab cannot be saved, and says so.
    await userEvent.click(await screen.findByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Add at least one component');

    await userEvent.click(screen.getByRole('button', { name: 'Add Experiment Details to Tab 1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith('/api/eln/templates', {
        method: 'POST',
        json: { name: 'Synthesis', templateTabs: [{ name: 'Tab 1', components: [{ type: 'experimentDetails' }] }] },
      }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe('/templates/created'));
  });

  /** There is no building a template without a name. */
  it('sends /templates/new without a name back to the list', async () => {
    const router = await renderAt('/templates/new');
    await waitFor(() => expect(router.state.location.pathname).toBe('/templates'));
  });

  it('renames a template through PATCH, with the name alone', async () => {
    await renderAt(`/templates/${DEFAULT.id}`);

    await userEvent.click(await screen.findByRole('button', { name: 'Rename template' }));
    const input = screen.getByRole('textbox', { name: 'Template Name' });
    await userEvent.clear(input);
    await userEvent.type(input, 'Synthesis{Enter}');

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(`/api/eln/templates/${DEFAULT.id}`, {
        method: 'PATCH',
        json: { name: 'Synthesis' },
      }),
    );
  });

  it('deletes a template, and goes back to the list', async () => {
    const router = await renderAt(`/templates/${DEFAULT.id}`);

    await userEvent.click(await screen.findByRole('button', { name: 'Delete template' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(`/api/eln/templates/${DEFAULT.id}`, { method: 'DELETE' }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe('/templates'));
    // The page let go of the template rather than fetching it back — and toasting the refusal.
    const calls = apiFetch.mock.calls;
    const deletedAt = calls.findIndex(([, init]) => init?.method === 'DELETE');
    const refetched = calls
      .slice(deletedAt + 1)
      .some(([path, init]) => path === `/api/eln/templates/${DEFAULT.id}` && !init?.method);
    expect(refetched).toBe(false);
  });

  /** Without MANAGE_TEMPLATES the page is not shown at all. */
  it('turns away a user without MANAGE_TEMPLATES', async () => {
    currentUser = makeCurrentUser({ permissions: ['VIEW_PROJECTS'] });
    const router = await renderAt('/templates');

    await waitFor(() => expect(router.state.location.pathname).not.toBe('/templates'));
    expect(screen.queryByRole('heading', { name: 'Templates' })).not.toBeInTheDocument();
  });
});
