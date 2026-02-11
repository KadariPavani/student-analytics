import './LoadingDots.css';

function LoadingDots({ full = false }) {
  const className = `loading-dots${full ? ' loading-dots--full' : ''}`;
  return (
    <div className={className}>
      <span></span>
      <span></span>
      <span></span>
    </div>
  );
}

export default LoadingDots;
