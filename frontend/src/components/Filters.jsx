import { useState, useEffect } from 'react';
import api from '../api';
import './Filters.css';

function Filters({ onFilterChange, showSearch = true, showPlacedFilter = false }) {
  const [branches, setBranches] = useState([]);
  const [years, setYears] = useState([]);
  const [filters, setFilters] = useState({
    search: '',
    branch: '',
    passout_year: '',
    college: '',
    gender: '',
    placed: '',
  });

  useEffect(() => {
    api.get('/students/branches').then(res => setBranches(res.data)).catch(() => {});
    api.get('/batches/years').then(res => setYears(res.data)).catch(() => {});
  }, []);

  const handleChange = (field, value) => {
    const updated = { ...filters, [field]: value };
    setFilters(updated);
    onFilterChange(updated);
  };

  const handleReset = () => {
    const cleared = { search: '', branch: '', passout_year: '', college: '', gender: '', placed: '' };
    setFilters(cleared);
    onFilterChange(cleared);
  };

  return (
    <div className="filters">
      {showSearch && (
        <input
          type="text"
          placeholder="Search by name or roll number..."
          value={filters.search}
          onChange={e => handleChange('search', e.target.value)}
          className="filter-search"
        />
      )}
      <select value={filters.branch} onChange={e => handleChange('branch', e.target.value)}>
        <option value="">All Branches</option>
        {branches.map(b => (
          <option key={b} value={b}>{b}</option>
        ))}
      </select>
      <select value={filters.passout_year} onChange={e => handleChange('passout_year', e.target.value)}>
        <option value="">All Years</option>
        {years.map(y => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
      <select value={filters.college} onChange={e => handleChange('college', e.target.value)}>
        <option value="">All Colleges</option>
        <option value="KIET">KIET</option>
        <option value="KIEW">KIEW</option>
        <option value="KIEK">KIEK</option>
      </select>
      {showPlacedFilter && (
        <select value={filters.placed} onChange={e => handleChange('placed', e.target.value)}>
          <option value="">All Students</option>
          <option value="true">Placed Only</option>
          <option value="false">Unplaced Only</option>
        </select>
      )}
      <button onClick={handleReset} className="filter-reset">Reset</button>
    </div>
  );
}

export default Filters;
