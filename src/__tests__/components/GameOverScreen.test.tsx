import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GameOverScreen from '../../components/GameOverScreen';
import type { GameStats } from '../../game/types';

const defaultStats: GameStats = {
  score: 150,
  highScore: 300,
  wordsFound: 12,
  bestWord: 'BONJOUR',
  combo: 0,
  maxCombo: 3,
};

describe('GameOverScreen', () => {
  it('displays all stats', () => {
    render(<GameOverScreen stats={defaultStats} onRetry={vi.fn()} onMenu={vi.fn()} />);
    expect(screen.getByText('GAME OVER')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getByText('300')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('BONJOUR')).toBeInTheDocument();
  });

  it('shows combo when maxCombo > 1', () => {
    render(<GameOverScreen stats={defaultStats} onRetry={vi.fn()} onMenu={vi.fn()} />);
    expect(screen.getByText('x3')).toBeInTheDocument();
  });

  it('hides combo when maxCombo <= 1', () => {
    const stats = { ...defaultStats, maxCombo: 1 };
    render(<GameOverScreen stats={stats} onRetry={vi.fn()} onMenu={vi.fn()} />);
    expect(screen.queryByText(/x1/)).not.toBeInTheDocument();
  });

  it('calls onRetry when retry button clicked', () => {
    const onRetry = vi.fn();
    render(<GameOverScreen stats={defaultStats} onRetry={onRetry} onMenu={vi.fn()} />);
    fireEvent.click(screen.getByText('REJOUER'));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('calls onMenu when menu button clicked', () => {
    const onMenu = vi.fn();
    render(<GameOverScreen stats={defaultStats} onRetry={vi.fn()} onMenu={onMenu} />);
    fireEvent.click(screen.getByText('MENU'));
    expect(onMenu).toHaveBeenCalledOnce();
  });
});
