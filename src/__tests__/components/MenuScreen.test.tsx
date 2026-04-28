import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MenuScreen from '../../components/MenuScreen';

vi.mock('../../api/client', () => ({
  isLoggedIn: vi.fn(() => false),
  getUser: vi.fn(() => null),
  logout: vi.fn(),
}));

vi.mock('../../game/engine', () => ({
  getHighScore: vi.fn(() => 420),
}));

describe('MenuScreen', () => {
  const defaultProps = {
    onModeSelect: vi.fn(),
    onProfile: vi.fn(),
    onLogout: vi.fn(),
    lang: 'fr',
    onLangChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders title and subtitle', () => {
    render(<MenuScreen {...defaultProps} />);
    expect(screen.getByText('WORD DOGS')).toBeInTheDocument();
  });

  it('renders solo mode button', () => {
    render(<MenuScreen {...defaultProps} />);
    expect(screen.getByText('SOLO')).toBeInTheDocument();
  });

  it('calls onModeSelect with solo when solo clicked', () => {
    const onModeSelect = vi.fn();
    render(<MenuScreen {...defaultProps} onModeSelect={onModeSelect} />);
    fireEvent.click(screen.getByText('SOLO'));
    expect(onModeSelect).toHaveBeenCalledWith('solo');
  });

  it('renders the three remaining mode buttons (no VS AI)', () => {
    render(<MenuScreen {...defaultProps} />);
    expect(screen.getByText('SOLO')).toBeInTheDocument();
    expect(screen.queryByText('CONTRE IA')).not.toBeInTheDocument();
    expect(screen.getByText('DUEL LOCAL')).toBeInTheDocument();
    expect(screen.getByText('EN LIGNE')).toBeInTheDocument();
  });

  it('calls onModeSelect("online") when EN LIGNE clicked', () => {
    const onModeSelect = vi.fn();
    render(<MenuScreen {...defaultProps} onModeSelect={onModeSelect} />);
    fireEvent.click(screen.getByText('EN LIGNE'));
    expect(onModeSelect).toHaveBeenCalledWith('online');
  });

  it('renders language picker with both languages', () => {
    render(<MenuScreen {...defaultProps} />);
    expect(screen.getByText('Français')).toBeInTheDocument();
    expect(screen.getByText('English')).toBeInTheDocument();
  });

  it('calls onLangChange when language button clicked', () => {
    const onLangChange = vi.fn();
    render(<MenuScreen {...defaultProps} onLangChange={onLangChange} />);
    fireEvent.click(screen.getByText('English'));
    expect(onLangChange).toHaveBeenCalledWith('en');
  });

  it('does not render the difficulty picker', () => {
    render(<MenuScreen {...defaultProps} />);
    expect(screen.queryByText('Facile')).not.toBeInTheDocument();
    expect(screen.queryByText('Difficile')).not.toBeInTheDocument();
  });

  it('displays high score', () => {
    render(<MenuScreen {...defaultProps} />);
    expect(screen.getByText('420')).toBeInTheDocument();
  });

  it('does not show profile button when not logged in', () => {
    render(<MenuScreen {...defaultProps} />);
    expect(screen.queryByText('MON PROFIL')).not.toBeInTheDocument();
  });
});
