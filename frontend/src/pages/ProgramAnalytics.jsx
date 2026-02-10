import { useState, useEffect } from 'react';
import api from '../api';
import StatsCard from '../components/StatsCard';
import { MultiBarChartCard } from '../components/Charts';
import DataTable from '../components/DataTable';
import './ProgramAnalytics.css';

function ProgramAnalytics() {
  const [overview, setOverview] = useState(null);
  const [collegeData, setCollegeData] = useState([]);
  const [branchData, setBranchData] = useState([]);
  const [yearWiseSummary, setYearWiseSummary] = useState([]);
  const [years, setYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/batches/years').then(res => setYears(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = selectedYear ? { passout_year: selectedYear } : {};
    Promise.all([
      api.get('/analytics/overview', { params }),
      api.get('/analytics/college-wise'),
      api.get('/analytics/branch-wise', { params }),
      api.get('/analytics/year-wise-summary'),
    ])
      .then(([ov, cw, bw, yws]) => {
        setOverview(ov.data);
        setCollegeData(cw.data);
        setBranchData(bw.data);
        setYearWiseSummary(yws.data);
      })
      .catch(err => console.error('Error:', err))
      .finally(() => setLoading(false));
  }, [selectedYear]);

  if (loading) return <div className="loading">Loading statistics...</div>;

  const o = overview || {};
  const totalStudents = Number(o.total_students || 0);
  const campusPlaced = Number(o.placed_students || 0);
  const totalPlaced = Number(o.total_placed_all || 0);
  const fmmlRegistered = Number(o.total_fmml || 0);
  const fmmlPlaced = Number(o.fmml_placed || 0);
  const khubRegistered = Number(o.total_khub || 0);
  const khubPlaced = Number(o.khub_placed || 0);

  const overallPct = totalStudents ? ((totalPlaced / totalStudents) * 100).toFixed(2) : '0';
  const campusPct = totalStudents ? ((campusPlaced / totalStudents) * 100).toFixed(2) : '0';
  const fmmlPct = fmmlRegistered ? ((fmmlPlaced / fmmlRegistered) * 100).toFixed(2) : '0';
  const khubPct = khubRegistered ? ((khubPlaced / khubRegistered) * 100).toFixed(2) : '0';

  // Average CTC statistics removed per admin request
  const ctcPremium = null;

  // Chart data: source-wise comparison
  const sourceChartData = [
    { name: 'Campus', Students: campusPlaced },
    { name: 'FMML (Placed)', Students: fmmlPlaced },
    { name: 'KHUB', Students: khubPlaced },
  ];

  // College-wise summary
  const collegeColumns = [
    { key: 'college', label: 'College' },
    { key: 'total_students', label: 'Intake' },
    { key: 'placed_students', label: 'Campus Placed' },
    { key: 'placement_rate', label: 'Rate %', render: (val) => <strong>{val}%</strong> },
    { key: 'fmml_placed', label: 'FMML Placed', render: (val) => val > 0 ? <span className="badge badge--fmml">{val}</span> : '-' },
    { key: 'khub_students', label: 'KHUB Placed', render: (val) => val > 0 ? <span className="badge badge--khub">{val}</span> : '-' },
  ];

  // Branch-wise summary
  const branchColumns = [
    { key: 'branch', label: 'Branch' },
    { key: 'total_students', label: 'Intake' },
    { key: 'placed_students', label: 'Campus Placed' },
    { key: 'placement_rate', label: 'Rate %', render: (val) => <strong>{val}%</strong> },
    { key: 'fmml_placed', label: 'FMML Placed', render: (val) => val > 0 ? <span className="badge badge--fmml">{val}</span> : '-' },
    { key: 'khub_students', label: 'KHUB Placed', render: (val) => val > 0 ? <span className="badge badge--khub">{val}</span> : '-' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-top">
          <div>
            <h1>Placement Statistics Summary</h1>
          </div>
          <div className="year-filter">
            <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
              <option value="">All Years</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ═══ SECTION 1: Overall Placement Summary ═══ */}
      <div className="summary-section">

        {/* <div className="summary-hero">
          <div className="hero-main">
            <div className="hero-number">{totalStudents.toLocaleString()}</div>
            <div className="hero-label">Total Intake</div>
          </div>
          <div className="hero-arrow">&#8594;</div>
          <div className="hero-main hero-main--success">
            <div className="hero-number">{totalPlaced.toLocaleString()}</div>
            <div className="hero-label">Total Placed</div>
          </div>
          <div className="hero-arrow">=</div>
          <div className="hero-main hero-main--primary">
            <div className="hero-number">{overallPct}%</div>
            <div className="hero-label">Placement Rate</div>
          </div>
        </div> */}

        {/* Breakdown table */}
        <div className="card breakdown-card">
          <table className="breakdown-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Students Placed</th>
                <th>% of Total Intake</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><span className="source-label source-label--campus">Campus Placed students</span> <span className="source-desc">On-Campus</span></td>
                <td className="num-cell"><strong>{campusPlaced.toLocaleString()}</strong></td>
                <td className="num-cell">{campusPct}%</td>
              </tr>
                <tr className="khub-row">
                <td><span className="source-label source-label--khub">KHUB</span> <span className="source-desc">{khubPlaced} placed / {khubRegistered} registered</span></td>
                <td className="num-cell"><strong>{khubPlaced.toLocaleString()}</strong></td>
                <td className="num-cell">{khubPct}% <span className="pct-note">of registered</span></td>
              </tr>
              <tr className="fmml-row">
                <td><span className="source-label source-label--fmml">FMML</span> <span className="source-desc">{fmmlPlaced} placed / {fmmlRegistered} registered</span></td>
                <td className="num-cell"><strong>{fmmlPlaced.toLocaleString()}</strong></td>
                <td className="num-cell">{fmmlPct}% <span className="pct-note">of registered</span></td>
              </tr>

              <tr className="total-row">
                <td><strong>Total Placed Students</strong></td>
                <td className="num-cell"><strong>{totalPlaced.toLocaleString()}</strong></td>
                <td className="num-cell"><strong>{overallPct}%</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ SECTION: Year-wise Placement Statistics ═══ */}
      <div className="summary-section">
        <h2 className="section-title">Year-wise Placement Statistics</h2>
        <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: 16 }}>
                  </p>

        <div className="card">
          <div style={{ overflowX: 'auto' }}>
            <table className="summary-table">
              <thead>
                <tr>
                  <th rowSpan="2" style={{ minWidth: 100 }}>Year</th>
                  <th rowSpan="2" style={{ minWidth: 100 }}>Total Intake</th>
                  <th colSpan="2" style={{ background: '#e3f2fd', borderBottom: '2px solid #2196f3' }}>Campus (On/Off/Pool)</th>
                  <th colSpan="2" style={{ background: '#fff3e0', borderBottom: '2px solid #ff9800' }}>FMML</th>
                  <th colSpan="2" style={{ background: '#e8f5e9', borderBottom: '2px solid #4caf50' }}>KHUB</th>
                  <th colSpan="2" style={{ background: '#f3e5f5', borderBottom: '2px solid #9c27b0' }}>Total Placed</th>
                </tr>
                <tr>
                  <th style={{ background: '#e3f2fd' }}>Placed</th>
                  <th style={{ background: '#e3f2fd' }}>% of Intake</th>
                  <th style={{ background: '#fff3e0' }}>Placed/Registered</th>
                  <th style={{ background: '#fff3e0' }}>% Registered</th>
                  <th style={{ background: '#e8f5e9' }}>Placed/Registered</th>
                  <th style={{ background: '#e8f5e9' }}>% Registered</th>
                  <th style={{ background: '#f3e5f5' }}>Students</th>
                  <th style={{ background: '#f3e5f5' }}>% of Intake</th>
                </tr>
              </thead>
              <tbody>
                {yearWiseSummary.map(row => (
                  <tr key={row.passout_year}>
                    <td style={{ fontWeight: 600 }}>{row.passout_year}</td>
                    <td style={{ fontWeight: 600 }}>{row.total_students?.toLocaleString() || 0}</td>
                    
                    {/* Campus */}
                    <td style={{ background: '#fafafa' }}>{row.campus_placed?.toLocaleString() || 0}</td>
                    <td style={{ background: '#fafafa', fontWeight: 600, color: '#2196f3' }}>
                      {row.campus_pct || 0}%
                    </td>
                    
                    {/* FMML */}
                    <td style={{ background: '#fafafa' }}>
                      {row.fmml_placed?.toLocaleString() || 0} / {row.fmml_registered?.toLocaleString() || 0}
                    </td>
                    <td style={{ background: '#fafafa', fontWeight: 600, color: '#ff9800' }}>
                      {row.fmml_pct || 0}%
                    </td>
                    
                    {/* KHUB */}
                    <td style={{ background: '#fafafa' }}>
                      {row.khub_placed?.toLocaleString() || 0} / {row.khub_registered?.toLocaleString() || 0}
                    </td>
                    <td style={{ background: '#fafafa', fontWeight: 600, color: '#4caf50' }}>
                      {row.khub_pct || 0}%
                    </td>
                    
                    {/* Total */}
                    <td style={{ background: '#fafafa', fontWeight: 600 }}>{row.total_placed?.toLocaleString() || 0}</td>
                    <td style={{ background: '#fafafa', fontWeight: 600, color: '#9c27b0' }}>
                      {row.total_pct || 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Year-wise Charts with Percentages */}
        <div className="grid-2" style={{ marginTop: 24 }}>
          <MultiBarChartCard
            title="College, FMML and KHUB - Year Wise (% Placed)"
            data={yearWiseSummary.map(row => ({
              name: String(row.passout_year),
              'Campus %': row.campus_pct || 0,
              'FMML %': row.fmml_pct || 0,
              'KHUB %': row.khub_pct || 0,
            }))}
            bars={[
              { dataKey: 'Campus %', name: 'Campus % (of intake)', fill: '#2196f3' },
              { dataKey: 'FMML %', name: 'FMML % (of registered)', fill: '#ff9800' },
              { dataKey: 'KHUB %', name: 'KHUB % (of registered)', fill: '#4caf50' },
            ]}
            xKey="name"
          />
          <MultiBarChartCard
            title="Students Placed - Year Wise (Count)"
            data={yearWiseSummary.map(row => ({
              name: String(row.passout_year),
              'Campus': row.campus_placed || 0,
              'FMML': row.fmml_placed || 0,
              'KHUB': row.khub_placed || 0,
            }))}
            bars={[
              { dataKey: 'Campus', name: 'Campus Placed', fill: '#2196f3' },
              { dataKey: 'FMML', name: 'FMML Placed', fill: '#ff9800' },
              { dataKey: 'KHUB', name: 'KHUB Placed', fill: '#4caf50' },
            ]}
            xKey="name"
            subtitle="Number of students placed by category"
          />
        </div>
      </div>
      {/* ═══ SECTION 5: College-wise Breakdown ═══ */}
      <div className="summary-section">
        <h2 className="section-title">College-wise Breakdown</h2>
        <div className="card">
          <DataTable columns={collegeColumns} data={collegeData} />
        </div>
      </div>

      {/* ═══ SECTION 6: Branch-wise Breakdown ═══ */}
      <div className="summary-section">
        <h2 className="section-title">Branch-wise Breakdown</h2>
        <div className="card">
          <DataTable columns={branchColumns} data={branchData} />
        </div>
      </div>
    </div>
  );
}

export default ProgramAnalytics;
