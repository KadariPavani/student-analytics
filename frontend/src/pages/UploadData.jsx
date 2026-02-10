import { useState, useEffect } from 'react';
import api from '../api';
import './Admin.css';

function UploadData() {
  const [passoutYear, setPassoutYear] = useState('');
  const [years, setYears] = useState([]);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    api.get('/batches/years').then(res => setYears(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (passoutYear) {
      setLoadingHistory(true);
      api.get('/upload/history', { params: { passout_year: passoutYear } })
        .then(res => setHistory(res.data))
        .catch(() => {})
        .finally(() => setLoadingHistory(false));
    }
  }, [passoutYear, result]);

  const handleDownloadTemplate = () => {
    window.open('http://localhost:5000/api/upload/template', '_blank');
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);

    if (!passoutYear) {
      setError('Please select a passout year. Add a batch first if none exist.');
      return;
    }
    if (!file) {
      setError('Please select an Excel file');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('passout_year', passoutYear);

    setUploading(true);
    try {
      const res = await api.post('/upload/combined', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data);
      setFile(null);
      const fileInput = document.getElementById('file-input');
      if (fileInput) fileInput.value = '';
    } catch (err) {
      const data = err.response?.data;
      if (data?.hint) {
        setError(`${data.error}\n\nHint: ${data.hint}\nFound columns: ${(data.present_keys || []).join(', ')}`);
      } else {
        setError(data?.error || 'Upload failed');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleClearData = async (type) => {
    if (!passoutYear) return;
    const label = type === 'all' ? 'ALL' : type.toUpperCase();
    if (!window.confirm(`Clear ${label} data for batch ${passoutYear}?`)) return;
    try {
      const res = await api.delete('/upload/data', {
        params: { passout_year: passoutYear, type },
      });
      setResult({ message: res.data.message, summary: null });
    } catch (err) {
      setError(err.response?.data?.error || 'Clear failed');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Upload Data</h1>
        <p>Upload a single Excel file with 3 sheets: <strong>Placements</strong>, <strong>FMML</strong>, <strong>KHUB</strong></p>
      </div>

      <div className="grid-2">
        {/* Upload Form */}
        <div className="card">
          <div className="card-header">
            <h3>Upload Batch Data</h3>
          </div>
          <p className="card-description">
            Upload one <code>.xlsx</code> file containing three sheets.
            The sheets are matched by name (Placements, FMML, KHUB) or by position (1st, 2nd, 3rd).
            Empty sheets are skipped.
          </p>

          <form onSubmit={handleUpload} className="upload-form">
            <div className="form-group">
              <label>Passout Year</label>
              <select value={passoutYear} onChange={e => setPassoutYear(e.target.value)} required>
                <option value="">Select Year</option>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              {years.length === 0 && (
                <span className="form-hint">No batches found. Add a batch in Batch Management first.</span>
              )}
            </div>

            <div className="form-group">
              <label>Excel File (.xlsx)</label>
              <input
                id="file-input"
                type="file"
                accept=".xlsx,.xls"
                onChange={e => setFile(e.target.files[0])}
                required
              />
            </div>

            {error && <div className="alert alert--error">{error}</div>}

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={uploading}>
                {uploading ? 'Uploading...' : 'Upload File'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleDownloadTemplate}>
                Download Template
              </button>
            </div>

            {passoutYear && (
              <div className="clear-actions" style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => handleClearData('all')}>
                  Clear All Data for {passoutYear}
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => handleClearData('placements')}>
                  Clear Placements
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => handleClearData('fmml')}>
                  Clear FMML
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => handleClearData('khub')}>
                  Clear KHUB
                </button>
              </div>
            )}
          </form>

          {/* Upload Result */}
          {result && (
            <div className="upload-result" style={{ marginTop: 16 }}>
              <div className="alert alert--success">{result.message}</div>
              {result.summary && (
                <table className="mini-table" style={{ marginTop: 8 }}>
                  <thead>
                    <tr><th>Sheet</th><th>Rows</th><th>Added</th><th>Skipped</th></tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><span className="badge badge--placements">PLACEMENTS</span></td>
                      <td>{result.summary.placements.rows}</td>
                      <td>{result.summary.placements.added}</td>
                      <td>{result.summary.placements.skipped}</td>
                    </tr>
                    <tr>
                      <td><span className="badge badge--fmml">FMML</span></td>
                      <td>{result.summary.fmml.rows}</td>
                      <td>{result.summary.fmml.added}</td>
                      <td>{result.summary.fmml.skipped}</td>
                    </tr>
                    <tr>
                      <td><span className="badge badge--khub">KHUB</span></td>
                      <td>{result.summary.khub.rows}</td>
                      <td>{result.summary.khub.added}</td>
                      <td>{result.summary.khub.skipped}</td>
                    </tr>
                  </tbody>
                </table>
              )}
              {result.errors && result.errors.length > 0 && (
                <div className="result-errors">
                  <h4>Errors:</h4>
                  <ul>{result.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sheet Column Reference */}
        <div className="card">
          <div className="card-header">
            <h3>Excel Sheet Reference</h3>
          </div>
          <div className="field-reference">
            <div className="alert alert--info" style={{ marginBottom: 12, fontSize: '0.85rem' }}>
              <strong>No need for branch or college columns!</strong> They are auto-derived from the roll number.<br/>
              e.g. <code>22JN1A0501</code> → JN = KIEW, 05 = CSE
            </div>

            <h4 style={{ marginTop: 0 }}>Roll Number Codes</h4>
            <table className="mini-table" style={{ fontSize: '0.8rem', marginBottom: 12 }}>
              <thead><tr><th>College Code</th><th>College</th><th></th><th>Branch Code</th><th>Branch</th></tr></thead>
              <tbody>
                <tr><td>B2</td><td>KIET</td><td></td><td>05</td><td>CSE</td></tr>
                <tr><td>JN</td><td>KIEW</td><td></td><td>04</td><td>ECE</td></tr>
                <tr><td>6Q</td><td>KIEK</td><td></td><td>03</td><td>MECH</td></tr>
                <tr><td></td><td></td><td></td><td>02</td><td>EEE</td></tr>
                <tr><td></td><td></td><td></td><td>01</td><td>CIVIL</td></tr>
                <tr><td></td><td></td><td></td><td>42</td><td>CSM</td></tr>
                <tr><td></td><td></td><td></td><td>43</td><td>CAI</td></tr>
                <tr><td></td><td></td><td></td><td>44</td><td>CSD</td></tr>
                <tr><td></td><td></td><td></td><td>45</td><td>AID</td></tr>
                <tr><td></td><td></td><td></td><td>46</td><td>CSC</td></tr>
              </tbody>
            </table>

            <hr />

            {/* Sheet 1 */}
            <h4>Sheet 1 — Placements</h4>
            <p className="field-note">One row per placement offer. Same student can have multiple rows.</p>
            <strong>Required:</strong>
            <div className="field-list">
              {['roll_no', 'student_name', 'company_name', 'ctc_lpa'].map(f => (
                <span key={f} className="field-tag field-tag--required">{f}</span>
              ))}
            </div>
            <strong>Optional:</strong>
            <div className="field-list">
              {['offer_type', 'role', 'source', 'offer_date', 'gender', 'tenth_pct', 'twelfth_pct', 'grad_cgpa', 'phone', 'email'].map(f => (
                <span key={f} className="field-tag field-tag--optional">{f}</span>
              ))}
            </div>
            <ul className="field-notes-list">
              <li><strong>offer_type</strong>: IT or Non-IT (also accepts Core)</li>
              <li><strong>ctc_lpa</strong>: Package in LPA (e.g. 7.5)</li>
              <li>Column aliases: NAME, COMPANY, PACKAGE, IT/NON IT also work</li>
            </ul>

            <hr />

            {/* Sheet 2 */}
            <h4>Sheet 2 — FMML</h4>
            <strong>Required:</strong>
            <div className="field-list">
              {['roll_no', 'student_name'].map(f => (
                <span key={f} className="field-tag field-tag--required">{f}</span>
              ))}
            </div>
            <strong>Optional:</strong>
            <div className="field-list">
              {['fmml_batch', 'status', 'module_name', 'score', 'certificate_id', 'completion_date'].map(f => (
                <span key={f} className="field-tag field-tag--optional">{f}</span>
              ))}
            </div>
            <ul className="field-notes-list">
              <li><strong>status</strong>: Enrolled, Completed, Dropped</li>
              <li>Column aliases: NAME, ROLL NO also work</li>
            </ul>

            <hr />

            {/* Sheet 3 */}
            <h4>Sheet 3 — KHUB Placements</h4>
            <p className="field-note">Placements sourced through KHUB. These are recorded separately from Sheet 1 placements.</p>
            <strong>Required:</strong>
            <div className="field-list">
              {['roll_no', 'student_name', 'company_name', 'ctc_lpa'].map(f => (
                <span key={f} className="field-tag field-tag--required">{f}</span>
              ))}
            </div>
            <strong>Optional:</strong>
            <div className="field-list">
              {['offer_type', 'role', 'offer_date'].map(f => (
                <span key={f} className="field-tag field-tag--optional">{f}</span>
              ))}
            </div>
            <ul className="field-notes-list">
              <li><strong>offer_type</strong>: IT or Non-IT</li>
              <li>Column aliases: NAME, COMPANY, PACKAGE, IT/NON IT also work</li>
              <li>Source auto-set to <strong>KHUB</strong></li>
            </ul>
          </div>
        </div>
      </div>

      {/* Upload History */}
      {passoutYear && (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-header">
            <h3>Upload History — Batch {passoutYear}</h3>
          </div>
          {loadingHistory ? (
            <div className="loading">Loading history...</div>
          ) : history.length === 0 ? (
            <div className="empty-state"><p>No uploads yet for this batch.</p></div>
          ) : (
            <table className="mini-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>File</th>
                  <th>Added</th>
                  <th>Skipped</th>
                  <th>Uploaded By</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.id}>
                    <td><span className={`badge badge--${h.upload_type}`}>{h.upload_type.toUpperCase()}</span></td>
                    <td>{h.file_name}</td>
                    <td>{h.records_added}</td>
                    <td>{h.records_skipped}</td>
                    <td>{h.uploaded_by_name || h.username}</td>
                    <td>{new Date(h.uploaded_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export default UploadData;
