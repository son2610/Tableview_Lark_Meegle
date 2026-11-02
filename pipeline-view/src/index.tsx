import './styles/tokens.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import type { BaseAdapter } from './sdk/adapter';
import { App } from './components/App';

function wantsMock(params: URLSearchParams): boolean {
  return process.env.PV_MOCK === '1' || params.has('mock');
}

/** Dynamic imports keep the SDK out of the demo build and the mock out of the main chunk. */
async function createAdapter(): Promise<BaseAdapter> {
  const params = new URLSearchParams(window.location.search);
  if (wantsMock(params)) {
    const mod = await import('./sdk/mock/mockAdapter');
    return await mod.createMockAdapter(params);
  }
  const mod = await import('./sdk/larkAdapter');
  return await mod.createLarkAdapter();
}

function StartupError(props: { message: string }) {
  const style: React.CSSProperties = {
    maxWidth: 480,
    margin: '64px auto',
    padding: 24,
    borderRadius: 12,
    border: '1px solid var(--pv-border)',
    background: 'var(--pv-surface)',
    color: 'var(--pv-text)',
    textAlign: 'center',
  };
  return (
    <div style={style} role="alert">
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Không khởi tạo được Pipeline View · Could not start Pipeline View</div>
      <div style={{ color: 'var(--pv-text-2)', fontSize: 13, wordBreak: 'break-word' }}>{props.message}</div>
    </div>
  );
}

async function main() {
  const container = document.getElementById('root');
  if (!container) return;
  const root = createRoot(container);
  try {
    const adapter = await createAdapter();
    root.render(<App adapter={adapter} />);
  } catch (e) {
    console.error('[pipeline-view] adapter creation failed', e);
    root.render(<StartupError message={e instanceof Error ? e.message : String(e)} />);
  }
}

void main();
