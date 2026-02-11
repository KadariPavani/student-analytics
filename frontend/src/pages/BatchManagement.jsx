import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import './Admin.css';

function BatchManagement() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formYear, setFormYear] = useState(new Date().getFullYear());
  const [entries, setEntries] = useState([{ college: 'KIET', branch: '', total_students: '' }]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const branches = ['CSE', 'ECE', 'MECH', 'EEE', 'CAI', 'CSC', 'AID', 'CSM', 'CSD'];
  const colleges = ['KIET', 'KIEW', 'KIEK'];

  const loadBatches = useCallback(async () => {
    try {
      const res = await api.get('/batches');
      setBatches(res.data);
    } catch (err) {
      console.error('Load batches error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadBatches(); }, [loadBatches]);

  const addEntry = () => {
    setEntries([...entries, { college: 'KIET', branch: '', total_students: '' }]);
  };

  const removeEntry = (idx) => {
    setEntries(entries.filter((_, i) => i !== idx));
  };

  const updateEntry = (idx, field, value) => {
    const updated = [...entries];
    updated[idx] = { ...updated[idx], [field]: value };
    setEntries(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    const validEntries = entries.filter(en => en.branch && en.total_students);
    if (validEntries.length === 0) {
      setMessage({ type: 'error', text: 'Add at least one valid entry' });
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/batches', { passout_year: parseInt(formYear), entries: validEntries });
      setMessage({ type: 'success', text: res.data.message });
      setShowForm(false);
      setEntries([{ college: 'KIET', branch: '', total_students: '' }]);
      loadBatches();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteYear = async (year) => {
    if (!window.confirm(`Delete ALL data for batch ${year}? This cannot be undone.`)) return;
    try {
      await api.delete(`/batches/year/${year}`);
      setMessage({ type: 'success', text: `Batch ${year} deleted` });
      loadBatches();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Delete failed' });
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Batch Management</h1>
        <p>Manage passout year batches and student intake numbers</p>
      </div>

      {message && (
        <div className={`alert alert--${message.type}`}>{message.text}</div>
      )}

      <div className="admin-toolbar">
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add New Batch'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header"><h3>Add / Update Batch Intake</h3></div>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Passout Year</label>
                <input
                  type="number"
                  value={formYear}
                  onChange={e => setFormYear(e.target.value)}
                  min={2020}
                  max={2035}
                  required
                />
              </div>
            </div>
            <div className="intake-entries">
              <h4>Intake Entries (College + Branch + Student Count)</h4>
              {entries.map((entry, idx) => (
                <div key={idx} className="intake-row">
                  <select value={entry.college} onChange={e => updateEntry(idx, 'college', e.target.value)}>
                    {colleges.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select value={entry.branch} onChange={e => updateEntry(idx, 'branch', e.target.value)} required>
                    <option value="">Select Branch</option>
                    {branches.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                  <input
                    type="number"
                    placeholder="Total Students"
                    value={entry.total_students}
                    onChange={e => updateEntry(idx, 'total_students', e.target.value)}
                    min={1}
                    required
                  />
                  {entries.length > 1 && (
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => removeEntry(idx)}>Remove</button>
                  )}
                </div>
              ))}
              <button type="button" className="btn btn-secondary btn-sm" onClick={addEntry}>+ Add Entry</button>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Batch'}
              </button>
            </div>
          </form>
        </div>
      )}

      {batches.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <h3>No batches added yet</h3>
            <p>Click "Add New Batch" to create your first passout year batch with intake numbers.</p>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header"><h3>Passout Year Batches</h3></div>
          <div style={{ overflowX: 'auto' }}>
            <table className="mini-table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Total Intake</th>
                  <th>Registered</th>
                  <th>Placed</th>
                  <th>FMML</th>
                  <th>KHUB</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {batches.map(batch => (
                  <tr key={batch.passout_year}>
                    <td style={{ fontWeight: 600 }}>{batch.passout_year}</td>
                    <td>{batch.total_intake?.toLocaleString() || 0}</td>
                    <td>{batch.registered_students?.toLocaleString() || 0}</td>
                    <td>{batch.placed_students?.toLocaleString() || 0}</td>
                    <td>{batch.fmml_count?.toLocaleString() || 0}</td>
                    <td>{batch.khub_count?.toLocaleString() || 0}</td>
                    <td>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDeleteYear(batch.passout_year)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default BatchManagement;
