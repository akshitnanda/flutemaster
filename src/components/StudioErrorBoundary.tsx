import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface StudioErrorBoundaryProps {
  children: React.ReactNode;
  variant?: 'fullscreen' | 'stage';
}

interface StudioErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class StudioErrorBoundary extends React.Component<
  StudioErrorBoundaryProps,
  StudioErrorBoundaryState
> {
  constructor(props: StudioErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): StudioErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unexpected studio rendering error',
    };
  }

  componentDidCatch(_error: Error, _info: React.ErrorInfo) {
    // Error captured cleanly by UI fallback; keep production console quiet
  }

  private handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.variant === 'stage') {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-[#141311] border-b border-white/10 p-6 text-center">
          <AlertTriangle className="w-7 h-7 text-[#f4a261]" />
          <div className="space-y-1 max-w-md">
            <h2 className="text-sm font-semibold text-[#f8f9fa]">
              3D Instrument Stage Unavailable
            </h2>
            <p className="text-xs text-[#a69f95]">
              WebGL context was interrupted on this device. The Sargam Highway, Audio Studio, and
              Guides remain fully playable below.
            </p>
          </div>
          <button
            onClick={this.handleReset}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#2a9d8f] hover:bg-[#33b0a1] text-xs font-semibold text-[#f8f9fa] cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Retry 3D Stage
          </button>
        </div>
      );
    }

    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center gap-4 bg-[#121212] text-[#f8f9fa] p-6 text-center">
        <AlertTriangle className="w-9 h-9 text-[#f4a261]" />
        <div className="space-y-1.5 max-w-md">
          <h1 className="text-lg font-semibold">FluteMaster Wind Studio hit a snag</h1>
          <p className="text-xs text-[#a69f95]">{this.state.errorMessage}</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#d4a373] hover:bg-[#e3b78a] text-[#121212] text-xs font-semibold cursor-pointer transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Reload Wind Studio
        </button>
      </div>
    );
  }
}
