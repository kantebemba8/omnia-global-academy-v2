/** A Builder fault must not blank out the rest of Omnia Global Academy. */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { captureError } from '../../lib/sentry';

type Props = { children: ReactNode; returnTo: string };
type State = { error: boolean; retry: number; reference: string };

export default class StudioRouteBoundary extends Component<Props, State> {
  state: State = { error: false, retry: 0, reference: '' };

  static getDerivedStateFromError(): Partial<State> { return { error: true }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const reference = `OGA-STUDIO-${Date.now().toString(36).toUpperCase()}`;
    console.error('OGA studio route failed', reference, error, info.componentStack);
    captureError(error, { reference, route: 'formation-studio', componentStack: info.componentStack });
    this.setState({ reference });
  }

  render() {
    if (this.state.error) {
      return <main className="flex min-h-[100dvh] items-center justify-center bg-slate-50 p-4">
        <section role="alert" className="w-full max-w-lg rounded-2xl border-t-4 border-[#BF8813] bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-xl font-bold text-[#002050]">L’éditeur de formation a rencontré une erreur</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Une partie de l’éditeur n’a pas pu s’afficher. Aucune suppression de formation n’a été demandée.
            Vous pouvez réessayer ou revenir à la liste des formations.
          </p>
          {this.state.reference && <p className="mt-3 font-mono text-xs text-slate-500">Référence : {this.state.reference}</p>}
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={() => this.setState(current => ({ error: false, retry: current.retry + 1, reference: '' }))}
              className="rounded-lg bg-[#002050] px-4 py-2.5 text-sm font-semibold text-white">Réouvrir l’éditeur</button>
            <a href={this.props.returnTo} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-[#002050]">Mes formations</a>
          </div>
        </section>
      </main>;
    }
    // Key forces a clean mount when recovering, without reusing the failed editor state.
    return <div key={this.state.retry} className="contents">{this.props.children}</div>;
  }
}
