import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SplashScreen from '../../components/SplashScreen';

describe('SplashScreen', () => {
  it('renders the title', () => {
    render(<SplashScreen />);
    expect(screen.getByText('WARDOGS')).toBeInTheDocument();
  });

  it('renders the logo', () => {
    render(<SplashScreen />);
    expect(screen.getByAltText('BH Studios')).toBeInTheDocument();
  });

  it('renders the loading bar', () => {
    const { container } = render(<SplashScreen />);
    expect(container.querySelector('.loader-bar')).toBeInTheDocument();
  });
});
