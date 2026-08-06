export default function TopBar({ judul, konteks, aksi }) {
  return (
    <div className="top-bar">
      <div>
        <div className="top-bar__judul">{judul}</div>
        {konteks && <div className="top-bar__konteks">{konteks}</div>}
      </div>
      {aksi}
    </div>
  );
}
