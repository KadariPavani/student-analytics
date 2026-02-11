import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import DataTable from '../components/DataTable';
import LoadingDots from '../components/LoadingDots';
import './StudentDetail.css';

function StudentDetail() {
  const { rollNo } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/students/${rollNo}`)
      .then(res => setData(res.data))
      .catch(err => console.error('Error:', err))
      .finally(() => setLoading(false));
  }, [rollNo]);

  if (loading) return <LoadingDots />;
  if (!data) return <div className="error">Student not found</div>;

  const { student, placements, fmml, khub } = data;

  const placementColumns = [
    { key: 'company_name', label: 'Company' },
    {
      key: 'ctc_lpa',
      label: 'CTC (LPA)',
      render: (val) => <strong style={{ color: 'var(--primary)' }}>₹{val}</strong>,
    },
    {
      key: 'offer_type',
      label: 'Type',
      render: (val) => <span className={`badge badge--${val}`}>{val}</span>,
    },
    { key: 'role', label: 'Role' },
    { key: 'source', label: 'Source' },
    {
      key: 'offer_date',
      label: 'Date',
      render: (val) => val ? new Date(val).toLocaleDateString() : '—',
    },
  ];

  const fmmlList = Array.isArray(fmml) ? fmml : (fmml ? [fmml] : []);
  const khubList = Array.isArray(khub) ? khub : (khub ? [khub] : []);
  const isKhubMember = khubList.length > 0;

  return (
    <div>
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate('/students')}>← Back to Students</button>
        <h1>{student.name}</h1>
        <p>{student.roll_no} · {student.college} · {student.branch} · {student.passout_year}</p>
      </div>

      <div className="student-profile card">
        <div className="profile-grid">
          <div><label>Roll Number</label><span>{student.roll_no}</span></div>
          <div><label>Name</label><span>{student.name}</span></div>
          <div><label>College</label><span>{student.college}</span></div>
          <div><label>Branch</label><span>{student.branch}</span></div>
          <div><label>Passout Year</label><span>{student.passout_year}</span></div>
          <div><label>Gender</label><span>{student.gender}</span></div>
          <div><label>10th %</label><span>{student.tenth_pct || 'N/A'}</span></div>
          <div><label>12th %</label><span>{student.twelfth_pct || 'N/A'}</span></div>
          <div><label>CGPA</label><span>{student.grad_cgpa || 'N/A'}</span></div>
          <div><label>Phone</label><span>{student.phone || 'N/A'}</span></div>
          <div><label>Email</label><span>{student.email || 'N/A'}</span></div>
          <div>
            <label>Status</label>
            <span>
              {placements.length > 0
                ? <span className="badge badge--placed">Placed ({placements.length} offer{placements.length > 1 ? 's' : ''})</span>
                : <span className="badge badge--unplaced">Not Placed</span>}
              {fmmlList.length > 0 && <span className="badge badge--fmml" style={{ marginLeft: 6 }}>FMML</span>}
              {isKhubMember && <span className="badge badge--khub" style={{ marginLeft: 6 }}>KHUB</span>}
            </span>
          </div>
        </div>
      </div>

      {/* All Placement Offers */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header"><h3>All Placement Offers</h3></div>
        {placements.length > 0
          ? <DataTable columns={placementColumns} data={placements} />
          : <p className="no-data">No placement offers recorded.</p>
        }
      </div>

      {/* FMML & KHUB Membership */}
      <div className="program-cards">
        <div className="card program-card">
          <div className="card-header"><h3>FMML Participation</h3></div>
          {fmmlList.length > 0 ? (
            fmmlList.map((f, i) => (
              <div key={i} className="program-info" style={i > 0 ? { borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 12 } : {}}>
                <div><label>Batch</label><span>{f.fmml_batch}</span></div>
                <div><label>Status</label><span className={`badge badge--${f.status}`}>{f.status}</span></div>
                <div><label>Module</label><span>{f.module_name || 'N/A'}</span></div>
                <div><label>Score</label><span>{f.score ?? 'N/A'}</span></div>
                <div><label>Certificate</label><span>{f.certificate_id || 'N/A'}</span></div>
              </div>
            ))
          ) : <p className="no-data">Not enrolled in FMML.</p>}
        </div>

        <div className="card program-card">
          <div className="card-header"><h3>KHUB Membership</h3></div>
          {isKhubMember ? (
            khubList.map((k, i) => (
              <div key={i} className="program-info" style={i > 0 ? { borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 12 } : {}}>
                <div><label>Status</label><span className={`badge badge--${k.status}`}>{k.status}</span></div>
                <div><label>Activity</label><span>{k.activity_type || 'N/A'}</span></div>
                <div><label>Club</label><span>{k.club_name || 'KHUB'}</span></div>
                {k.completion_date && <div><label>Completion</label><span>{new Date(k.completion_date).toLocaleDateString()}</span></div>}
                {k.remarks && <div><label>Remarks</label><span>{k.remarks}</span></div>}
              </div>
            ))
          ) : <p className="no-data">Not a KHUB member.</p>}
        </div>
      </div>
    </div>
  );
}

export default StudentDetail;
