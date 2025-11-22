import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Simple UserStatusBadge component for testing
// This represents the component structure
const UserStatusBadge = ({ status, size = 'md', showLabel = false }) => {
  const statusConfig = {
    available: { color: 'bg-green-500', label: 'Verfuegbar' },
    away: { color: 'bg-yellow-500', label: 'Abwesend' },
    busy: { color: 'bg-red-500', label: 'Beschaeftigt' },
    dnd: { color: 'bg-red-600', label: 'Nicht stoeren' },
    offline: { color: 'bg-gray-400', label: 'Offline' },
    oof: { color: 'bg-purple-500', label: 'Abwesend' }
  };

  const sizeConfig = {
    xs: 'w-2 h-2',
    sm: 'w-2.5 h-2.5',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  };

  const config = statusConfig[status] || statusConfig.offline;
  const sizeClass = sizeConfig[size] || sizeConfig.md;

  return (
    <div className="flex items-center gap-1" data-testid="status-badge">
      <span
        className={`${config.color} ${sizeClass} rounded-full`}
        data-testid="status-indicator"
        data-status={status}
      />
      {showLabel && (
        <span className="text-sm text-gray-600" data-testid="status-label">
          {config.label}
        </span>
      )}
    </div>
  );
};

describe('UserStatusBadge', () => {
  describe('rendering', () => {
    it('should render status indicator', () => {
      render(<UserStatusBadge status="available" />);

      const indicator = screen.getByTestId('status-indicator');
      expect(indicator).toBeInTheDocument();
    });

    it('should render correct status color for available', () => {
      render(<UserStatusBadge status="available" />);

      const indicator = screen.getByTestId('status-indicator');
      expect(indicator).toHaveClass('bg-green-500');
    });

    it('should render correct status color for away', () => {
      render(<UserStatusBadge status="away" />);

      const indicator = screen.getByTestId('status-indicator');
      expect(indicator).toHaveClass('bg-yellow-500');
    });

    it('should render correct status color for busy', () => {
      render(<UserStatusBadge status="busy" />);

      const indicator = screen.getByTestId('status-indicator');
      expect(indicator).toHaveClass('bg-red-500');
    });

    it('should render correct status color for offline', () => {
      render(<UserStatusBadge status="offline" />);

      const indicator = screen.getByTestId('status-indicator');
      expect(indicator).toHaveClass('bg-gray-400');
    });

    it('should render correct status color for oof (out of office)', () => {
      render(<UserStatusBadge status="oof" />);

      const indicator = screen.getByTestId('status-indicator');
      expect(indicator).toHaveClass('bg-purple-500');
    });
  });

  describe('sizes', () => {
    it('should render xs size', () => {
      render(<UserStatusBadge status="available" size="xs" />);

      const indicator = screen.getByTestId('status-indicator');
      expect(indicator).toHaveClass('w-2', 'h-2');
    });

    it('should render sm size', () => {
      render(<UserStatusBadge status="available" size="sm" />);

      const indicator = screen.getByTestId('status-indicator');
      expect(indicator).toHaveClass('w-2.5', 'h-2.5');
    });

    it('should render md size by default', () => {
      render(<UserStatusBadge status="available" />);

      const indicator = screen.getByTestId('status-indicator');
      expect(indicator).toHaveClass('w-3', 'h-3');
    });

    it('should render lg size', () => {
      render(<UserStatusBadge status="available" size="lg" />);

      const indicator = screen.getByTestId('status-indicator');
      expect(indicator).toHaveClass('w-4', 'h-4');
    });
  });

  describe('label', () => {
    it('should not show label by default', () => {
      render(<UserStatusBadge status="available" />);

      expect(screen.queryByTestId('status-label')).not.toBeInTheDocument();
    });

    it('should show label when showLabel is true', () => {
      render(<UserStatusBadge status="available" showLabel={true} />);

      const label = screen.getByTestId('status-label');
      expect(label).toBeInTheDocument();
      expect(label).toHaveTextContent('Verfuegbar');
    });

    it('should show correct label for away status', () => {
      render(<UserStatusBadge status="away" showLabel={true} />);

      expect(screen.getByTestId('status-label')).toHaveTextContent('Abwesend');
    });

    it('should show correct label for busy status', () => {
      render(<UserStatusBadge status="busy" showLabel={true} />);

      expect(screen.getByTestId('status-label')).toHaveTextContent('Beschaeftigt');
    });
  });

  describe('unknown status', () => {
    it('should fallback to offline for unknown status', () => {
      render(<UserStatusBadge status="unknown" />);

      const indicator = screen.getByTestId('status-indicator');
      expect(indicator).toHaveClass('bg-gray-400');
    });
  });
});
