import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AuthScreen from '../../components/AuthScreen';

describe('AuthScreen', () => {
  it('renders login form by default', () => {
    render(<AuthScreen onDone={vi.fn()} />);
    expect(screen.getByText('Connexion')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Mot de passe')).toBeInTheDocument();
  });

  it('switches to signup form', () => {
    render(<AuthScreen onDone={vi.fn()} />);
    fireEvent.click(screen.getByText('Créer un compte'));
    expect(screen.getByText('Inscription')).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Nom d'utilisateur")).toBeInTheDocument();
  });

  it('switches back to login from signup', () => {
    render(<AuthScreen onDone={vi.fn()} />);
    fireEvent.click(screen.getByText('Créer un compte'));
    fireEvent.click(screen.getByText('Se connecter'));
    expect(screen.getByText('Connexion')).toBeInTheDocument();
  });

  it('calls onDone when skip button is clicked', () => {
    const onDone = vi.fn();
    render(<AuthScreen onDone={onDone} />);
    fireEvent.click(screen.getByText('Jouer sans compte'));
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('renders skip auth button', () => {
    render(<AuthScreen onDone={vi.fn()} />);
    expect(screen.getByText('Jouer sans compte')).toBeInTheDocument();
  });
});
