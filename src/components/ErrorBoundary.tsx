'use client';

import { Component, type ReactNode } from 'react';

/** Prevents a render error in one screen from blanking the whole app. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-8 text-center">
          <div className="text-4xl">🐮</div>
          <p className="text-white/70">Something hiccuped.</p>
          <button onClick={this.reset} className="btn-primary px-6 py-3">
            Reload screen
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
