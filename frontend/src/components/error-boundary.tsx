import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './ui/button';
import { Card, CardDescription, CardTitle } from './ui/card';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary', error, info);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="mx-auto flex min-h-screen max-w-lg items-center px-4">
        <Card className="w-full space-y-3 p-6 text-center">
          <CardTitle>Что-то пошло не так</CardTitle>
          <CardDescription>
            Во время отображения страницы произошла непредвиденная ошибка.
          </CardDescription>
          <Button onClick={() => window.location.reload()}>Перезагрузить</Button>
        </Card>
      </div>
    );
  }
}
