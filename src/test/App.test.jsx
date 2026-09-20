import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import App from '../App';

describe('GUIDER App Component Rendering', () => {
  it('renders brand name and dashboard greeting without crashing', () => {
    render(<App />);
    expect(screen.getAllByText('GUIDER').length).toBeGreaterThan(0);
    expect(screen.getByText('What are you working on right now?')).toBeInTheDocument();
  });

  it('renders the 4 primary quick-action buttons on home screen', () => {
    render(<App />);
    expect(screen.getByText(/📷 Show Me/i)).toBeInTheDocument();
    expect(screen.getByText(/✍️ Ask GUIDER/i)).toBeInTheDocument();
    expect(screen.getByText(/🎤 Speak/i)).toBeInTheDocument();
    expect(screen.getByText(/➕ New Task/i)).toBeInTheDocument();
  });
});
