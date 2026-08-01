import { motion, AnimatePresence } from 'motion/react';
import type { CSSProperties, ReactNode } from 'react';

// ============================================================================
// Button (with hover/tap animations)
// ============================================================================

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  style?: CSSProperties;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  disabled,
  onClick,
  type = 'button',
  style,
  children,
}: ButtonProps) {
  const baseStyle: CSSProperties = {
    border: 'none',
    borderRadius: '8px',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
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
    <motion.button
      type={type}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      style={{
        ...baseStyle,
        ...variantStyles[variant],
        ...sizeStyles[size],
        ...style,
      }}
      whileHover={disabled ? undefined : { scale: 1.03 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
    >
      {children}
    </motion.button>
  );
}

// ============================================================================
// Card (with entrance animation)
// ============================================================================

interface CardProps {
  children: ReactNode;
  style?: CSSProperties;
  /** Enable entrance animation */
  animate?: boolean;
  /** Delay for staggered animations */
  delay?: number;
  /** Enable hover lift effect */
  hover?: boolean;
}

export function Card({ children, style, animate = false, delay = 0, hover = false }: CardProps) {
  const baseStyle: CSSProperties = {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '12px',
    padding: '20px',
    ...style,
  };

  if (!animate && !hover) {
    return <div style={baseStyle}>{children}</div>;
  }

  return (
    <motion.div
      style={baseStyle}
      initial={animate ? { opacity: 0, y: 20 } : false}
      animate={animate ? { opacity: 1, y: 0 } : undefined}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 25,
        delay,
      }}
      whileHover={hover ? { 
        y: -4, 
        boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
        transition: { type: 'spring', stiffness: 400, damping: 20, delay: 0 }
      } : undefined}
    >
      {children}
    </motion.div>
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
// PlayerBadge (with entrance and pulse animations)
// ============================================================================

interface PlayerBadgeProps {
  avatar: string;
  username: string;
  isHost?: boolean;
  isConnected?: boolean;
  score?: number;
  size?: 'small' | 'medium';
  /** Enable entrance animation */
  animate?: boolean;
  /** Delay for staggered animations */
  delay?: number;
  /** Highlight this player (e.g., current turn) */
  highlight?: boolean;
  /** Show promote button (callback when clicked) */
  onPromote?: () => void;
  /** Whether this is a CPU player */
  isCpu?: boolean;
}

export function PlayerBadge({
  avatar,
  username,
  isHost = false,
  isConnected = true,
  score,
  size = 'medium',
  animate = false,
  delay = 0,
  highlight = false,
  onPromote,
  isCpu = false,
}: PlayerBadgeProps) {
  const avatarSize = size === 'small' ? 28 : 36;
  
  // Show promote button if callback provided, player is not host, not CPU, and connected
  const showPromoteButton = onPromote && !isHost && !isCpu && isConnected;

  const content = (
    <>
      <Avatar src={avatar} alt={username} size={avatarSize} />
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: '#fff', fontWeight: 500 }}>{username}</span>
          {isHost && (
            <motion.span
              style={{
                backgroundColor: '#FAA61A',
                color: '#000',
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: '4px',
              }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 15, delay: delay + 0.1 }}
            >
              HOST
            </motion.span>
          )}
        </div>
        {!isConnected && (
          <span style={{ color: '#a0a0a0', fontSize: '12px' }}>Disconnected</span>
        )}
      </div>
      {score !== undefined && (
        <AnimatePresence mode="wait">
          <motion.span
            key={score}
            style={{ color: '#5865F2', fontWeight: 700, fontSize: '16px' }}
            initial={{ scale: 1.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          >
            {score}
          </motion.span>
        </AnimatePresence>
      )}
      {showPromoteButton && (
        <motion.button
          onClick={(e) => {
            e.stopPropagation();
            onPromote();
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '16px',
            opacity: 0.6,
            transition: 'opacity 0.15s, background-color 0.15s',
          }}
          whileHover={{ opacity: 1, backgroundColor: 'rgba(250, 166, 26, 0.2)' }}
          whileTap={{ scale: 0.9 }}
          title="Promote to Host"
        >
          👑
        </motion.button>
      )}
    </>
  );

  const baseStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: size === 'small' ? '6px 10px' : '8px 12px',
    backgroundColor: highlight ? 'rgba(88, 101, 242, 0.2)' : 'rgba(255, 255, 255, 0.05)',
    borderRadius: '8px',
    opacity: isConnected ? 1 : 0.5,
    border: highlight ? '2px solid #5865F2' : '2px solid transparent',
  };

  if (!animate) {
    return <div style={baseStyle}>{content}</div>;
  }

  return (
    <motion.div
      style={baseStyle}
      initial={{ opacity: 0, scale: 0.8, x: -20 }}
      animate={{ opacity: isConnected ? 1 : 0.5, scale: 1, x: 0 }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 20,
        delay,
      }}
    >
      {content}
    </motion.div>
  );
}

// ============================================================================
// Timer (with pulse animation when low)
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
      <motion.div
        style={{
          fontSize: '48px',
          fontWeight: 700,
          color: isLow ? '#ED4245' : '#fff',
          fontVariantNumeric: 'tabular-nums',
        }}
        animate={isLow ? { scale: [1, 1.1, 1] } : { scale: 1 }}
        transition={{
          duration: 0.5,
          repeat: isLow ? Infinity : 0,
          repeatType: 'reverse',
        }}
      >
        {seconds}
      </motion.div>
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
        <motion.div
          style={{
            height: '100%',
            backgroundColor: isLow ? '#ED4245' : '#5865F2',
          }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.1, ease: 'linear' }}
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
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '8px',
        padding: '14px 18px',
        fontSize: '18px',
        color: '#fff',
        outline: 'none',
        width: fullWidth ? '100%' : 'auto',
        boxSizing: 'border-box',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        ...style,
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = '#5865F2';
        e.currentTarget.style.boxShadow = '0 0 0 2px rgba(88, 101, 242, 0.3)';
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        e.currentTarget.style.boxShadow = 'none';
        props.onBlur?.(e);
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
        <motion.span
          key={value}
          style={{ color: '#fff', fontWeight: 600 }}
          initial={{ scale: 1.2, color: '#5865F2' }}
          animate={{ scale: 1, color: '#fff' }}
          transition={{ duration: 0.2 }}
        >
          {value}{unit}
        </motion.span>
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
// GifCard (with selection and hover animations)
// ============================================================================

interface GifCardProps {
  src: string;
  title?: string;
  selected?: boolean;
  onClick?: () => void;
  size?: 'small' | 'medium' | 'large';
  /** Enable entrance animation */
  animate?: boolean;
  /** Delay for staggered animations */
  delay?: number;
}

export function GifCard({
  src,
  title,
  selected,
  onClick,
  size = 'medium',
  animate = false,
  delay = 0,
}: GifCardProps) {
  const sizeMap = {
    small: 100,
    medium: 150,
    large: 200,
  };
  const dimension = sizeMap[size];

  const content = (
    <>
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
      {/* Selection checkmark */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 15 }}
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 24,
              height: 24,
              borderRadius: '50%',
              backgroundColor: '#5865F2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 700,
            }}
          >
            ✓
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );

  return (
    <motion.div
      onClick={onClick}
      style={{
        width: dimension,
        height: dimension,
        borderRadius: '8px',
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        border: selected ? '3px solid #5865F2' : '3px solid transparent',
        position: 'relative',
      }}
      initial={animate ? { opacity: 0, scale: 0.8 } : false}
      animate={animate ? { opacity: 1, scale: 1 } : undefined}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 25,
        delay,
      }}
      whileHover={onClick ? { scale: 1.05, y: -4 } : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
    >
      {content}
    </motion.div>
  );
}

// ============================================================================
// LoadingSpinner (with rotation)
// ============================================================================

export function LoadingSpinner({ size = 24 }: { size?: number }) {
  return (
    <motion.div
      style={{
        width: size,
        height: size,
        border: '3px solid rgba(255, 255, 255, 0.1)',
        borderTopColor: '#5865F2',
        borderRadius: '50%',
      }}
      animate={{ rotate: 360 }}
      transition={{
        duration: 1,
        repeat: Infinity,
        ease: 'linear',
      }}
    />
  );
}

// ============================================================================
// ScorePopup (for score reveal animations)
// ============================================================================

interface ScorePopupProps {
  score: number;
  label?: string;
  onComplete?: () => void;
}

export function ScorePopup({ score, label, onComplete }: ScorePopupProps) {
  const isPositive = score > 0;

  return (
    <motion.div
      style={{
        position: 'fixed',
        top: '25%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 100,
        textAlign: 'center',
        pointerEvents: 'none',
      }}
      initial={{ scale: 0, opacity: 0, y: 0 }}
      animate={{
        scale: [0, 1.3, 1],
        opacity: [0, 1, 1, 0],
        y: [0, 0, 0, -100],
      }}
      transition={{
        duration: 1.5,
        times: [0, 0.2, 0.6, 1],
        ease: 'easeOut',
      }}
      onAnimationComplete={onComplete}
    >
      {label && (
        <motion.div
          style={{
            color: '#a0a0a0',
            fontSize: '18px',
            marginBottom: '8px',
          }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {label}
        </motion.div>
      )}
      <motion.div
        style={{
          fontSize: '72px',
          fontWeight: 800,
          color: isPositive ? '#57F287' : '#ED4245',
          textShadow: '0 4px 20px rgba(0,0,0,0.5)',
        }}
      >
        {isPositive ? '+' : ''}{score}
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
// AnimatedList (helper for staggered list animations)
// ============================================================================

interface AnimatedListProps {
  children: ReactNode[];
  staggerDelay?: number;
}

export function AnimatedList({ children, staggerDelay = 0.05 }: AnimatedListProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

export const listItemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 25,
    },
  },
};

// ============================================================================
// ConfirmDialog (modal confirmation dialog)
// ============================================================================

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
        >
          <motion.div
            style={{
              backgroundColor: '#1a1a2e',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '400px',
              width: '90%',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ color: '#fff', margin: 0, marginBottom: '12px', fontSize: '1.25rem' }}>
              {title}
            </h3>
            <p style={{ color: '#a0a0d0', margin: 0, marginBottom: '24px', fontSize: '1rem' }}>
              {message}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={onCancel}>
                {cancelText}
              </Button>
              <Button variant="primary" onClick={onConfirm}>
                {confirmText}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
