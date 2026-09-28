import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

describe('App shell', () => {
  it('renders the sidebar logo', () => {
    render(<App />);
    expect(screen.getByText('Maitri–Bharati')).toBeInTheDocument();
  });

  it('renders navigation links', () => {
    render(<App />);
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Infrastructure')).toBeInTheDocument();
    expect(screen.getByText('Energy')).toBeInTheDocument();
    expect(screen.getByText('Logistics')).toBeInTheDocument();
    expect(screen.getByText('Environment')).toBeInTheDocument();
  });

  it('renders the overview page by default', () => {
    render(<App />);
    expect(screen.getByText('Operations Overview')).toBeInTheDocument();
  });
});
