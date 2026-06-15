import FilmForm from '../../../components/FilmForm';

export default function NewFilmPage() {
  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div>
          <div className="bot-name" style={{ fontSize: 18, marginBottom: 0 }}>sc·ai</div>
          <div className="bot-sub" style={{ marginBottom: 0 }}>New Film</div>
        </div>
      </header>
      <FilmForm mode="create" />
    </div>
  );
}
