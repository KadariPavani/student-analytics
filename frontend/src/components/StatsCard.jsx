import './StatsCard.css';

function StatsCard({ title, value, subtitle, color = 'primary', icon }) {
  return (
    <div className={`stats-card stats-card--${color}`}>
      {icon && <div className="stats-card__icon">{icon}</div>}
      <div className="stats-card__content">
        <div className="stats-card__title">{title}</div>
        <div className="stats-card__value">{value ?? '--'}</div>
        {subtitle && <div className="stats-card__subtitle">{subtitle}</div>}
      </div>
    </div>
  );
}

export default StatsCard;
