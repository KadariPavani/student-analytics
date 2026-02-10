import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import DataTable from '../components/DataTable';
import Filters from '../components/Filters';
import { BarChartCard } from '../components/Charts';
import './StudentPlacements.css';

/* ─────────────────── Students tab ─────────────────── */
function StudentsTab() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [filters, setFilters] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchStudents = useCallback(async (page = 1, currentFilters = filters) => {
    setLoading(true);
    try {
      const params = { page, limit: 25 };
      Object.entries(currentFilters).forEach(([k, v]) => {
        if (v) params[k] = v;
      });
      const res = await api.get('/students', { params });
      setStudents(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchStudents(1, filters);
  }, [filters]);

  const columns = [
    { key: 'roll_no', label: 'Roll No' },
    { key: 'name', label: 'Name' },
    { key: 'college', label: 'College' },
    { key: 'branch', label: 'Branch' },
    { key: 'passout_year', label: 'Year' },
    { key: 'gender', label: 'Gender' },
    {
      key: 'is_placed',
      label: 'Placed',
      render: (val) => val
        ? <span className="badge badge--placed">Placed</span>
        : <span className="badge badge--unplaced">No</span>,
    },
    {
      key: 'has_fmml',
      label: 'FMML',
      render: (val) => val ? <span className="badge badge--fmml">Yes</span> : '—',
    },
    {
      key: 'has_khub',
      label: 'KHUB',
      render: (val) => val ? <span className="badge badge--khub">Yes</span> : '—',
    },
  ];

  return (
    <>
      <p style={{ margin: '0 0 16px', color: 'var(--text-secondary)' }}>
        Browse {pagination.total.toLocaleString()} students across KIET / KIEW / KIEK
      </p>
      <div className="card">
        <Filters onFilterChange={setFilters} showPlacedFilter />
        <DataTable
          columns={columns}
          data={students}
          loading={loading}
          onRowClick={(row) => navigate(`/students/${row.roll_no}`)}
        />
        <div className="pagination">
          <button
            disabled={pagination.page <= 1}
            onClick={() => fetchStudents(pagination.page - 1)}
          >
            Previous
          </button>
          <span>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => fetchStudents(pagination.page + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </>
  );
}

/* ─────────────────── Placements tab ─────────────────── */
function PlacementsTab() {
  const [placements, setPlacements] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [companyData, setCompanyData] = useState([]);
  const [filters, setFilters] = useState({
    company: '', offer_type: '', passout_year: '', branch: '', source: '',
  });
  const [loading, setLoading] = useState(true);

  const fetchPlacements = async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: 25 };
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params[k] = v;
      });
      const res = await api.get('/placements', { params });
      setPlacements(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlacements(1);
  }, [filters]);

  useEffect(() => {
    // fetch all companies for the company-wise table (limit large enough to include all)
    api.get('/analytics/company-wise', { params: { limit: 1000 } })
      .then(res => setCompanyData(res.data))
      .catch(err => console.error('Error:', err));
  }, []);

  const handleChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const companyChartData = companyData.slice(0, 12).map(c => ({
    name: c.company_name.length > 12 ? c.company_name.slice(0, 12) + '\u2026' : c.company_name,
    Offers: parseInt(c.total_offers) || 0,
  }));

  const columns = [
    { key: 'roll_no', label: 'Roll No' },
    { key: 'name', label: 'Name' },
    { key: 'branch', label: 'Branch' },
    { key: 'company_name', label: 'Company' },
    {
      key: 'ctc_lpa',
      label: 'CTC (LPA)',
      render: (val) => <strong>{'\u20B9'}{val}</strong>,
    },
    {
      key: 'offer_type',
      label: 'Type',
      render: (val) => <span className={`badge badge--${val}`}>{val}</span>,
    },
    { key: 'source', label: 'Source' },
    { key: 'passout_year', label: 'Year' },
  ];

  return (
    <>
      <p style={{ margin: '0 0 16px', color: 'var(--text-secondary)' }}>
        {pagination.total.toLocaleString()} placement offers across all batches
      </p>

      <div className="card" style={{ marginBottom: 20 }}>
        <BarChartCard
          title="Top Companies by Offers"
          data={companyChartData}
          dataKey="Offers"
          xKey="name"
          fill="#4f46e5"
        />
      </div>

      <div className="card">
        <div className="placement-filters">
          <input
            type="text"
            placeholder="Search company..."
            value={filters.company}
            onChange={e => handleChange('company', e.target.value)}
            className="filter-search"
          />
          <select value={filters.offer_type} onChange={e => handleChange('offer_type', e.target.value)}>
            <option value="">All Types</option>
            <option value="IT">IT</option>
            <option value="Non-IT">Non-IT</option>
          </select>
          <select value={filters.passout_year} onChange={e => handleChange('passout_year', e.target.value)}>
            <option value="">All Years</option>
            {[2025, 2024, 2023, 2022, 2021].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select value={filters.source} onChange={e => handleChange('source', e.target.value)}>
            <option value="">All Sources</option>
            <option value="On-Campus">On-Campus</option>
            <option value="KHUB">KHUB</option>
          </select>
          <button
            onClick={() => setFilters({ company: '', offer_type: '', passout_year: '', branch: '', source: '' })}
            className="filter-reset"
          >
            Reset
          </button>
        </div>

        <DataTable columns={columns} data={placements} loading={loading} />

        <div className="pagination">
          <button disabled={pagination.page <= 1} onClick={() => fetchPlacements(pagination.page - 1)}>
            Previous
          </button>
          <span>Page {pagination.page} of {pagination.totalPages}</span>
          <button disabled={pagination.page >= pagination.totalPages} onClick={() => fetchPlacements(pagination.page + 1)}>
            Next
          </button>
        </div>
      </div>

      {/* Company details table */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header"><h3>Company-wise Summary</h3></div>
        <DataTable
          columns={[
            { key: 'company_name', label: 'Company' },
            { key: 'offer_type', label: 'Type', render: (val) => <span className={`badge badge--${val}`}>{val}</span> },
            { key: 'total_offers', label: 'Offers' },
            { key: 'unique_students', label: 'Students' },
            { key: 'max_ctc', label: 'Max CTC', render: (val) => `₹${val}` },
            { key: 'fmml_students', label: 'FMML', render: (val) => val > 0 ? <span className="badge badge--fmml">{val}</span> : '-' },
            { key: 'khub_students', label: 'KHUB', render: (val) => val > 0 ? <span className="badge badge--khub">{val}</span> : '-' },
          ]}
          data={companyData}
        />
      </div>
    </>
  );
}

/* ─────────────────── Combined page ─────────────────── */
function StudentPlacements() {
  const [activeTab, setActiveTab] = useState('students');
  const [downloading, setDownloading] = useState(false);

  const downloadPlacedExcel = async () => {
    try {
      setDownloading(true);
      // yearwise=true creates a sheet per passout year
      const res = await api.get('/students/export/placed?yearwise=true', { responseType: 'arraybuffer' });
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'placed_students_by_year.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
      alert('Failed to download file');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Student Placements</h1>
        <div style={{ marginLeft: 'auto' }}>
          <button onClick={downloadPlacedExcel} disabled={downloading} className="btn btn--secondary">
            {downloading ? 'Preparing...' : 'Download placed students (Excel)'}
          </button>
        </div>
      </div>

      <div className="sp-tabs">
        <button
          className={`sp-tab ${activeTab === 'students' ? 'active' : ''}`}
          onClick={() => setActiveTab('students')}
        >
          🎓 Students
        </button>
        <button
          className={`sp-tab ${activeTab === 'placements' ? 'active' : ''}`}
          onClick={() => setActiveTab('placements')}
        >
          💼 Placements
        </button>
      </div>

      {activeTab === 'students' ? <StudentsTab /> : <PlacementsTab />}
    </div>
  );
}

export default StudentPlacements;
