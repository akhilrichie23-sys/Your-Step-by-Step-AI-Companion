import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App';
import { TRANSLATIONS } from '../data/translations';

describe('GUIDER App Component Rendering & Internationalization', () => {
  beforeEach(() => {
    localStorage.clear();
  });

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

  it('switches entire UI language to Spanish when ES is selected', () => {
    render(<App />);
    
    // Find Spanish language button and click it
    const esButtons = screen.getAllByRole('button', { name: /^es$/i });
    fireEvent.click(esButtons[0]);

    // Check Spanish translations appear
    expect(screen.getByText('¿En qué estás trabajando ahora?')).toBeInTheDocument();
    expect(screen.getByText(/📷 Mostrar/i)).toBeInTheDocument();
    expect(screen.getByText(/✍️ Preguntar/i)).toBeInTheDocument();
    expect(screen.getByText(/🎤 Hablar/i)).toBeInTheDocument();
    expect(screen.getByText(/➕ Nueva Tarea/i)).toBeInTheDocument();
    expect(screen.getByText('Panel Principal')).toBeInTheDocument();
    expect(screen.getByText('Mis Proyectos')).toBeInTheDocument();
    expect(screen.getByText('Chats Recientes')).toBeInTheDocument();
    expect(screen.getByText('Configuración e IA')).toBeInTheDocument();
  });

  it('switches entire UI language to French when FR is selected', () => {
    render(<App />);
    
    // Find French language button and click it
    const frButtons = screen.getAllByRole('button', { name: /^fr$/i });
    fireEvent.click(frButtons[0]);

    // Check French translations appear
    expect(screen.getByText('Sur quoi travaillez-vous en ce moment ?')).toBeInTheDocument();
    expect(screen.getByText(/📷 Montrer/i)).toBeInTheDocument();
    expect(screen.getByText(/✍️ Demander/i)).toBeInTheDocument();
    expect(screen.getByText(/🎤 Parler/i)).toBeInTheDocument();
    expect(screen.getByText(/➕ Nouvelle Tâche/i)).toBeInTheDocument();
    expect(screen.getByText('Tableau de Bord')).toBeInTheDocument();
    expect(screen.getByText('Mes Projets')).toBeInTheDocument();
    expect(screen.getByText('Paramètres & IA')).toBeInTheDocument();
  });

  it('switches entire UI language to German when DE is selected', () => {
    render(<App />);
    const deButtons = screen.getAllByRole('button', { name: /^de$/i });
    fireEvent.click(deButtons[0]);

    expect(screen.getByText('Woran arbeitest du gerade?')).toBeInTheDocument();
    expect(screen.getByText(/📷 Zeigen/i)).toBeInTheDocument();
    expect(screen.getByText(/✍️ GUIDER fragen/i)).toBeInTheDocument();
    expect(screen.getByText('Übersicht')).toBeInTheDocument();
  });

  it('switches entire UI language to Japanese when JA is selected', () => {
    render(<App />);
    const jaButtons = screen.getAllByRole('button', { name: /^ja$/i });
    fireEvent.click(jaButtons[0]);

    expect(screen.getByText('今、何を作っていますか？')).toBeInTheDocument();
    expect(screen.getByText(/📷 見せる/i)).toBeInTheDocument();
    expect(screen.getByText(/✍️ GUIDERに質問/i)).toBeInTheDocument();
    expect(screen.getByText('ダッシュボード')).toBeInTheDocument();
  });

  it('switches entire UI language to Hindi when HI is selected', () => {
    render(<App />);
    const hiButtons = screen.getAllByRole('button', { name: /^hi$/i });
    fireEvent.click(hiButtons[0]);

    expect(screen.getByText('आप अभी किस पर काम कर रहे हैं?')).toBeInTheDocument();
    expect(screen.getByText(/📷 दिखाएं/i)).toBeInTheDocument();
    expect(screen.getByText(/✍️ गाइडर से पूछें/i)).toBeInTheDocument();
    expect(screen.getByText('डैशबोर्ड')).toBeInTheDocument();
  });

  it('allows user to edit profile and updates information across the whole website', () => {
    render(<App />);
    const profileBtn = screen.getByTitle('Profile');
    fireEvent.click(profileBtn);

    const editBtn = screen.getByText('Edit Profile');
    fireEvent.click(editBtn);

    // Change the name input
    const nameInput = screen.getByDisplayValue('Student Maker');
    fireEvent.change(nameInput, { target: { value: 'Alex The Maker' } });

    const saveBtn = screen.getByText('Save Profile');
    fireEvent.click(saveBtn);

    // Check that Alex The Maker appears across multiple places (header, sidebar, profile)
    const matches = screen.getAllByText('Alex The Maker');
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('displays enhanced security and safety controls in settings', () => {
    render(<App />);
    const settingsTabBtn = screen.getAllByText('Settings & AI Configuration')[0];
    fireEvent.click(settingsTabBtn);

    expect(screen.getByText('Security & Workshop Safety')).toBeInTheDocument();
    expect(screen.getByText('Student & Minor Protection Mode')).toBeInTheDocument();
    expect(screen.getByText('Local Photo Privacy Guard')).toBeInTheDocument();
    expect(screen.getByText('Hazard Checkpoint Lock')).toBeInTheDocument();
    expect(screen.getByText('Reset All Local & Cloud Data')).toBeInTheDocument();
  });
});
