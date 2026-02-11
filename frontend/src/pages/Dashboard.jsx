import { useState, useEffect } from 'react';
import api from '../api';
import StatsCard from '../components/StatsCard';
import { MultiBarChartCard, PieChartCard, LineChartCard } from '../components/Charts';
import DataTable from '../components/DataTable';
import './Dashboard.css';

function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [placementRate, setPlacementRate] = useState([]);
  const [ctcBands, setCtcBands] = useState([]);
  const [topPackages, setTopPackages] = useState([]);
  const [collegeWise, setCollegeWise] = useState([]);
  const [branchData, setBranchData] = useState([]);
  const [years, setYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Load available years
  useEffect(() => {
    api.get('/batches/years').then(res => setYears(res.data)).catch(() => {});
  }, []);

  // Load all data (re-fetch when year changes)
  useEffect(() => {
    setLoading(true);
    const params = selectedYear ? { passout_year: selectedYear } : {};

    Promise.all([
      api.get('/analytics/overview', { params }),
      api.get('/analytics/placement-rate'),
      api.get('/analytics/ctc-bands'),
      api.get('/analytics/top-packages', { params: { limit: 10 } }),
      api.get('/analytics/college-wise'),
      api.get('/analytics/branch-wise', { params }),
    ])
      .then(([ov, pr, cb, tp, cw, bw]) => {
        setOverview(ov.data);
        setPlacementRate(pr.data);
        setCtcBands(cb.data);
        setTopPackages(tp.data);
        setCollegeWise(cw.data);
        setBranchData(bw.data);
      })
      .catch(err => console.error('Dashboard error:', err))
      .finally(() => setLoading(false));
  }, [selectedYear]);

  // ── Derived chart data ──
  const rateChartData = placementRate.map(r => ({
    name: String(r.passout_year),
    'Avg CTC': parseFloat(r.avg_ctc) || 0,
  }));

  const ctcPieData = ctcBands.map(b => ({
    name: b.salary_band,
    value: parseInt(b.offer_count) || 0,
  }));

  const branchChartData = branchData.map(b => ({
    name: b.branch,
    'Placement %': parseFloat(b.placement_rate) || 0,
  }));

  const collegeChartData = collegeWise.map(c => ({
    name: c.college,
    'Placement %': parseFloat(c.placement_rate) || 0,
  }));

  const topColumns = [
    { key: 'name', label: 'Name' },
    { key: 'branch', label: 'Branch' },
    { key: 'college', label: 'College' },
    { key: 'company_name', label: 'Company' },
    {
      key: 'ctc_lpa',
      label: 'CTC (LPA)',
      render: (val) => <strong style={{ color: 'var(--primary)' }}>{val}</strong>,
    },
    {
      key: 'offer_type',
      label: 'Type',
      render: (val) => <span className={`badge badge--${val}`}>{val}</span>,
    },
    {
      key: 'source',
      label: 'Source',
      render: (val) => {
        const k = String(val || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return val ? <span className={`badge badge--${k}`}>{val}</span> : '-';
      }
    },
  ];

  const branchColumns = [
    { key: 'branch', label: 'Branch' },
    { key: 'total_students', label: 'Total' },
    { key: 'placed_students', label: 'Placed' },
    {
      key: 'placement_rate',
      label: 'Rate %',
      render: (val) => <strong>{val}%</strong>,
    },
    { key: 'max_ctc', label: 'Max CTC', render: (val) => val ? `₹${val}` : '-' },
    {
      key: 'fmml_placed',
      label: 'FMML',
      render: (val) => val > 0 ? <span className="badge badge--fmml">{val}</span> : '-',
    },
    {
      key: 'khub_students',
      label: 'KHUB Members',
      render: (val) => val > 0 ? <span className="badge badge--khub">{val}</span> : '-',
    },
  ];

  // Summary stats from branch data
  const totalBranchStudents = branchData.reduce((s, b) => s + parseInt(b.total_students || 0), 0);
  const totalBranchPlaced = branchData.reduce((s, b) => s + parseInt(b.placed_students || 0), 0);

  return (
    <div>
      {/* Header with year filter */}
      <div className="page-header">
        <div className="page-header-top">
          <div>
            <h1>Placement Analytics</h1>
            <p>KIET / KIEW / KIEK - Placement Statistics</p>
          </div>
          <div className="year-filter">
            <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
              <option value="">All Years</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="dash-tabs">
        <button className={`dash-tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          Overview
        </button>
        <button className={`dash-tab ${activeTab === 'branch' ? 'active' : ''}`} onClick={() => setActiveTab('branch')}>
          Branch-wise
        </button>
        <button className={`dash-tab ${activeTab === 'college' ? 'active' : ''}`} onClick={() => setActiveTab('college')}>
          College-wise
        </button>
      </div>

      {/* ═══════ TAB: Overview ═══════ */}
      {activeTab === 'overview' && (
        <>
          {/* Summary Statistics */}
          <div className="grid-4">
            <StatsCard
              title="Total Intake"
              value={Number(overview?.total_students || 0).toLocaleString()}
              subtitle={`${Number(overview?.total_offers || 0).toLocaleString()} offers`}
              color="primary"
            />
            <StatsCard
              title="Companies"
              value={overview?.companies_visited || 0}
              subtitle="Unique companies"
              color="success"
            />
            <StatsCard
              title="FMML Placement"
              value={`${overview?.fmml_pct || 0}%`}
              subtitle={`${overview?.fmml_placed || 0} placed / ${overview?.total_fmml || 0} enrolled`}
              color="warning"
            />
            <StatsCard
              title="KHUB Students"
              value={Number(overview?.total_khub || 0).toLocaleString()}
              subtitle={`${overview?.khub_placed || 0} placed (${overview?.total_khub > 0 ? Math.round(100 * overview?.khub_placed / overview?.total_khub) : 0}%)`}
              color="info"
            />
          </div>


          {/* Charts Row */}
          <div className="grid-2">
            <LineChartCard
              title="Year-wise Avg CTC"
              data={rateChartData}
              lines={[
                { dataKey: 'Avg CTC', name: 'Avg CTC (LPA)' },
              ]}
              xKey="name"
              subtitle="Average CTC (LPA) by passout year"
            />
            <PieChartCard
              title="CTC Band Distribution"
              data={ctcPieData}
              dataKey="value"
              nameKey="name"
              subtitle="Salary brackets"
            />
          </div>

          {/* Top Packages */}
          <div className="card" style={{ marginTop: 20 }}>
            <div className="card-header">
              <h3>Top 10 Packages</h3>
            </div>
            <DataTable columns={topColumns} data={topPackages} />
          </div>
        </>
      )}

      {/* ═══════ TAB: Branch-wise ═══════ */}
      {activeTab === 'branch' && (
        <>
          <div className="grid-4">
            <StatsCard title="Students" value={totalBranchStudents.toLocaleString()} subtitle={selectedYear || 'All years'} color="primary" />
            <StatsCard title="Placed" value={totalBranchPlaced.toLocaleString()} subtitle={totalBranchStudents ? `${(100 * totalBranchPlaced / totalBranchStudents).toFixed(1)}%` : ''} color="success" />
            <StatsCard title="FMML Placed" value={branchData.reduce((s, b) => s + parseInt(b.fmml_placed || 0), 0)} color="warning" />
            <StatsCard title="KHUB Students" value={branchData.reduce((s, b) => s + parseInt(b.khub_students || 0), 0)} subtitle="Placed members" color="info" />
          </div>

          <div className="grid-2">
            <MultiBarChartCard
              title="Branch-wise Placement Rate"
              data={branchChartData}
              bars={[
                { dataKey: 'Placement %', name: 'Placement Rate %' },
              ]}
              xKey="name"
            />
            <MultiBarChartCard
              title="College-wise Comparison"
              data={collegeChartData}
              bars={[
                { dataKey: 'Placement %', name: 'Placement Rate %' },
              ]}
              xKey="name"
            />
          </div>

          <div className="card" style={{ marginTop: 20 }}>
            <div className="card-header"><h3>Branch-wise Detail</h3></div>
            <DataTable columns={branchColumns} data={branchData} />
          </div>
        </>
      )}

      {/* ═══════ TAB: College-wise ═══════ */}
      {activeTab === 'college' && (
        <>
          <div className="grid-3">
            {collegeWise.map(c => (
              <div key={c.college} className="card college-card">
                <div className="card-header">
                  <h3>{c.college}</h3>
                  <span className="badge badge--primary">{c.placement_rate || 0}%</span>
                </div>
                <div className="college-stats">
                  <div className="college-stat">
                    <span className="college-stat-label">Total Intake</span>
                    <span className="college-stat-value">{Number(c.total_students).toLocaleString()}</span>
                  </div>
                  <div className="college-stat">
                    <span className="college-stat-label">Placed</span>
                    <span className="college-stat-value">{Number(c.placed_students).toLocaleString()}</span>
                  </div>

                  <div className="college-stat">
                    <span className="college-stat-label">Max CTC</span>
                    <span className="college-stat-value">₹{c.max_ctc || 0} LPA</span>
                  </div>
                  {parseInt(c.fmml_placed) > 0 && (
                    <div className="college-stat">
                      <span className="college-stat-label">FMML Placed</span>
                      <span className="college-stat-value">{c.fmml_placed}</span>
                    </div>
                  )}
                  {parseInt(c.khub_students) > 0 && (
                    <div className="college-stat">
                      <span className="college-stat-label">KHUB Placed</span>
                      <span className="college-stat-value">{c.khub_students}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="grid-2" style={{ marginTop: 20 }}>
            <MultiBarChartCard
              title="College Placement Comparison"
              data={collegeChartData}
              bars={[
                { dataKey: 'Placement %', name: 'Placement Rate %' },
                { dataKey: 'Avg CTC', name: 'Avg CTC (LPA)' },
              ]}
              xKey="name"
            />
            <div className="card">
              <div className="card-header"><h3>College Summary</h3></div>
              <DataTable
                columns={[
                  { key: 'college', label: 'College' },
                  { key: 'total_students', label: 'Intake' },
                  { key: 'placed_students', label: 'Placed' },
                  { key: 'placement_rate', label: 'Rate %', render: (val) => <strong>{val}%</strong> },
                    { key: 'max_ctc', label: 'Max CTC', render: (val) => val ? `₹${val}` : '-' },
                ]}
                data={collegeWise}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default Dashboard;
