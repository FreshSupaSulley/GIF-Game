import type { CSSProperties, ReactNode, ButtonHTMLAttributes } from 'react';

// ============================================================================
// Button
// ============================================================================

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  disabled,
  style,
  children,
  ...props
}: ButtonProps) {
  const baseStyle: CSSProperties = {
    border: 'none',
    borderRadius: '8px',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'background-color 0.2s, transform 0.1s',
    opacity: disabled ? 0.5 : 1,
    width: fullWidth ? '100%' : 'auto',
  };

  const variantStyles: Record<string, CSSProperties> = {
    primary: { backgroundColor: '#5865F2', color: '#fff' },
    secondary: { backgroundColor: '#4f545c', color: '#fff' },
    danger: { backgroundColor: '#ED4245', color: '#fff' },
  };

  const sizeStyles: Record<string, CSSProperties> = {
    small: { padding: '8px 16px', fontSize: '14px' },
    medium: { padding: '12px 24px', fontSize: '16px' },
    large: { padding: '16px 32px', fontSize: '18px' },
  };

  return (
    <button
      {...props}
      disabled={disabled}
      style={{
        ...baseStyle,
        ...variantStyles[variant],
        ...sizeStyles[size],
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// ============================================================================
// Card
// ============================================================================

interface CardProps {
  children: ReactNode;
  style?: CSSProperties;
}

export function Card({ children, style }: CardProps) {
  return (
    <div
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '12px',
        padding: '20px',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ============================================================================
// Avatar
// ============================================================================

interface AvatarProps {
  src: string;
  alt: string;
  size?: number;
  style?: CSSProperties;
}

export function Avatar({ src, alt, size = 40, style }: AvatarProps) {
  return (
    <img
      src={src}
      alt={alt}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        objectFit: 'cover',
        ...style,
      }}
    />
  );
}

// ============================================================================
// PlayerBadge
// ============================================================================

interface PlayerBadgeProps {
  avatar: string;
  username: string;
  isHost?: boolean;
  isConnected?: boolean;
  score?: number;
  size?: 'small' | 'medium';
}

export function PlayerBadge({
  avatar,
  username,
  isHost = false,
  isConnected = true,
  score,
  size = 'medium',
}: PlayerBadgeProps) {
  const avatarSize = size === 'small' ? 28 : 36;
  
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: size === 'small' ? '6px 10px' : '8px 12px',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '8px',
        opacity: isConnected ? 1 : 0.5,
      }}
    >
      <Avatar src={avatar} alt={username} size={avatarSize} />
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: '#fff', fontWeight: 500 }}>{username}</span>
          {isHost && (
            <span
              style={{
                backgroundColor: '#FAA61A',
                color: '#000',
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: '4px',
              }}
            >
              HOST
            </span>
          )}
        </div>
        {!isConnected && (
          <span style={{ color: '#a0a0a0', fontSize: '12px' }}>Disconnected</span>
        )}
      </div>
      {score !== undefined && (
        <span style={{ color: '#5865F2', fontWeight: 700, fontSize: '16px' }}>
          {score}
        </span>
      )}
    </div>
  );
}

// ============================================================================
// Timer
// ============================================================================

interface TimerProps {
  remainingMs: number;
  totalMs: number;
  label?: string;
}

export function Timer({ remainingMs, totalMs, label }: TimerProps) {
  const seconds = Math.ceil(remainingMs / 1000);
  const progress = totalMs > 0 ? remainingMs / totalMs : 0;
  const isLow = seconds <= 5;

  return (
    <div style={{ textAlign: 'center' }}>
      {label && <div style={{ color: '#a0a0a0', fontSize: '14px', marginBottom: '4px' }}>{label}</div>}
      <div
        style={{
          fontSize: '48px',
          fontWeight: 700,
          color: isLow ? '#ED4245' : '#fff',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {seconds}
      </div>
      <div
        style={{
          width: '100%',
          height: '4px',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '2px',
          overflow: 'hidden',
          marginTop: '8px',
        }}
      >
        <div
          style={{
            width: `${progress * 100}%`,
            height: '100%',
            backgroundColor: isLow ? '#ED4245' : '#5865F2',
            transition: 'width 0.1s linear',
          }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Input
// ============================================================================

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  fullWidth?: boolean;
}

export function Input({ fullWidth = false, style, ...props }: InputProps) {
  return (
    <input
      {...props}
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '8px',
        padding: '12px 16px',
        fontSize: '16px',
        color: '#fff',
        outline: 'none',
        width: fullWidth ? '100%' : 'auto',
        boxSizing: 'border-box',
        ...style,
      }}
    />
  );
}

// ============================================================================
// Slider
// ============================================================================

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  unit?: string;
}

export function Slider({ label, value, min, max, onChange, disabled, unit }: SliderProps) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <label style={{ color: '#a0a0a0', fontSize: '14px' }}>{label}</label>
        <span style={{ color: '#fff', fontWeight: 600 }}>
          {value}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        disabled={disabled}
        style={{
          width: '100%',
          accentColor: '#5865F2',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      />
    </div>
  );
}

// ============================================================================
// GifCard
// ============================================================================

interface GifCardProps {
  src: string;
  title?: string;
  selected?: boolean;
  onClick?: () => void;
  size?: 'small' | 'medium' | 'large';
}

export function GifCard({ src, title, selected, onClick, size = 'medium' }: GifCardProps) {
  const sizeMap = {
    small: 100,
    medium: 150,
    large: 200,
  };
  const dimension = sizeMap[size];

  return (
    <div
      onClick={onClick}
      style={{
        width: dimension,
        height: dimension,
        borderRadius: '8px',
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        border: selected ? '3px solid #5865F2' : '3px solid transparent',
        position: 'relative',
        transition: 'transform 0.2s, border-color 0.2s',
      }}
    >
      <img
        src={src}
        alt={title ?? 'GIF'}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
      {title && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '4px 8px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: '#fff',
            fontSize: '12px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {title}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// LoadingSpinner
// ============================================================================

export function LoadingSpinner({ size = 24 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        border: '3px solid rgba(255, 255, 255, 0.1)',
        borderTopColor: '#5865F2',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }}
    />
  );
}

// Add keyframes via style tag
if (typeof document !== 'undefined' && !document.getElementById('ui-keyframes')) {
  const style = document.createElement('style');
  style.id = 'ui-keyframes';
  style.textContent = `
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}
