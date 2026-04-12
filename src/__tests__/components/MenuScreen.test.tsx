import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MenuScreen from '../../components/MenuScreen';

// Mock the imports MenuScreen uses
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
    onPlay: vi.fn(),
    onProfile: vi.fn(),
    onMultiplayer: vi.fn(),
    onLogout: vi.fn(),
    lang: 'fr',
    onLangChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders title and subtitle', () => {
    render(<MenuScreen {...defaultProps} />);
    expect(screen.getByText('WARDOGS')).toBeInTheDocument();
  });

  it('renders play button', () => {
    render(<MenuScreen {...defaultProps} />);
    const playBtn = screen.getByText('JOUER');
    expect(playBtn).toBeInTheDocument();
  });

  it('calls onPlay when play button clicked', () => {
    const onPlay = vi.fn();
    render(<MenuScreen {...defaultProps} onPlay={onPlay} />);
    fireEvent.click(screen.getByText('JOUER'));
    expect(onPlay).toHaveBeenCalledOnce();
  });

  it('renders multiplayer button', () => {
    render(<MenuScreen {...defaultProps} />);
    expect(screen.getByText('MULTIJOUEUR')).toBeInTheDocument();
  });

  it('calls onMultiplayer when multiplayer clicked', () => {
    const onMultiplayer = vi.fn();
    render(<MenuScreen {...defaultProps} onMultiplayer={onMultiplayer} />);
    fireEvent.click(screen.getByText('MULTIJOUEUR'));
    expect(onMultiplayer).toHaveBeenCalledOnce();
  });

  it('renders language picker with both languages', () => {
    render(<MenuScreen {...defaultProps} />);
    expect(screen.getByText('Fran\u00e7ais')).toBeInTheDocument();
    expect(screen.getByText('English')).toBeInTheDocument();
  });

  it('calls onLangChange when language button clicked', () => {
    const onLangChange = vi.fn();
    render(<MenuScreen {...defaultProps} onLangChange={onLangChange} />);
    fireEvent.click(screen.getByText('English'));
    expect(onLangChange).toHaveBeenCalledWith('en');
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
