import React from 'react';
import './Button.css';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  className?: string;
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className = '',
  disabled = false
}) => {
  return (
    <button 
      className={`custom-btn btn-${variant} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="btn-content">{children}</span>
    </button>
  );
};
