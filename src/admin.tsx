import { useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import interviewCsvText from '../interviews/data.csv?raw';
import './admin.css';

const transcriptAssetMap = import.meta.glob('../interviews/*.srt', {
  eager: true,
  query: '?raw',
  import: 'default',
});

type Interview = {
  id: string;
  title: string;
  date: string;
  year: string;
  author: string;
  description: string;
  collection: string;
  sport: string;
  team: string;
  audioUrl: string;
  transcriptText: string;
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const pushField = () => {
    row.push(field.trim());
    field = '';
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (inQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      inQuotes = true;
      continue;
    }

    if (character === ',') {
      pushField();
      continue;
    }

    if (character === '\n') {
      pushField();
      rows.push(row);
      row = [];
      continue;
    }

    if (character !== '\r') {
      field += character;
    }
  }

  if (field.length > 0 || row.length > 0) {
    pushField();
    rows.push(row);
  }

  return rows.filter((entry) => entry.some((cell) => cell.length > 0));
}

function getAsset(map: Record<string, unknown>, id: string, extension: string) {
  const value = map[`../interviews/${id}${extension}`];
  return typeof value === 'string' ? value : '';
}

function buildInterviewAudioUrl(id: string) {
  const match = id.match(/_(\d+)$/);
  const numericId = match ? match[1] : id;

  return `https://cplorg.contentdm.oclc.org/digital/api/collection/p4014coll27/id/${numericId}/download`;
}

function parseInterviews(text: string): Interview[] {
  const rows = parseCsv(text);

  return rows.slice(1).map((row, index) => {
    const rawId = row[0] ?? index + 1;
    const id = String(rawId);

    return {
      id,
      title: row[1] ?? '',
      date: row[2] ?? '',
      year: row[3] ?? '',
      author: row[4] ?? '',
      description: row[5] ?? '',
      collection: row[6] ?? '',
      sport: row[7] ?? '',
      team: row[8] ?? '',
      audioUrl: buildInterviewAudioUrl(id),
      transcriptText: getAsset(transcriptAssetMap, id, '.srt'),
    };
  });
}

function AdminApp() {
  const interviews = useMemo(() => parseInterviews(interviewCsvText), []);
  const [filter, setFilter] = useState('');
  const [selectedId, setSelectedId] = useState(interviews[0]?.id ?? '');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saveMessage, setSaveMessage] = useState('Ready.');

  const selectedInterview = interviews.find((interview) => interview.id === selectedId) ?? interviews[0] ?? null;
  const query = filter.trim().toLowerCase();
  const visibleInterviews = query.length === 0
    ? interviews
    : interviews.filter((interview) => {
        return [interview.title, interview.collection, interview.description, interview.year, interview.id]
          .join(' ')
          .toLowerCase()
          .includes(query);
      });

  const transcript = selectedInterview ? drafts[selectedInterview.id] ?? selectedInterview.transcriptText : '';
  const dirty = selectedInterview ? transcript !== selectedInterview.transcriptText : false;

  const updateDraft = (value: string) => {
    if (!selectedInterview) {
      return;
    }

    setDrafts((current) => ({
      ...current,
      [selectedInterview.id]: value,
    }));
    setSaveMessage('Unsaved transcript edits are local only.');
  };

  const handleSave = () => {
    setSaveMessage('Changes saved.');
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <p className="admin-kicker">CPL librarian review panel</p>
          <h1 className="admin-title">Transcript editor</h1>
          <p className="admin-subtitle">Edit raw SRT files beside the corresponding interview audio.</p>
        </div>
        <div className="admin-status" aria-live="polite">
          {saveMessage}
        </div>
      </header>

      <main className="admin-layout">
        <aside className="admin-sidebar">
          <label className="admin-search" htmlFor="admin-search">
            <span>Search interviews</span>
            <input
              id="admin-search"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder='Try "Barnhart" or "1974"'
              type="search"
            />
          </label>

          <div className="interview-list" role="list" aria-label="Interview list">
            {visibleInterviews.map((interview) => (
              <button
                key={interview.id}
                className={`interview-card ${interview.id === selectedId ? 'is-active' : ''}`}
                onClick={() => setSelectedId(interview.id)}
                type="button"
              >
                <span className="interview-card-id">{interview.id}</span>
                <span className="interview-card-title">{interview.title}</span>
                <span className="interview-card-meta">{interview.year || interview.date || 'Undated'}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="admin-workbench">
          {selectedInterview ? (
            <>
              <section className="admin-panel transcript-panel-card">
                <div className="panel-heading">
                  <div>
                    <p className="panel-kicker">Raw transcript</p>
                    <h2>{selectedInterview.title}</h2>
                  </div>
                  <div className="panel-note">{dirty ? 'Edited locally' : 'Source transcript loaded'}</div>
                </div>

                <textarea
                  aria-label="Raw SRT transcript editor"
                  className="transcript-editor"
                  onChange={(event) => updateDraft(event.target.value)}
                  spellCheck={false}
                  value={transcript}
                  wrap="off"
                />

                <div className="editor-actions">
                  <button className="save-button" onClick={handleSave} type="button">
                    Save transcript
                  </button>
                  {/* <p className="save-help">Save is a placeholder for now.</p> */}
                </div>
              </section>

              <section className="admin-side-stack">
                <section className="admin-panel media-panel">
                  <div className="panel-heading">
                    <div>
                      <p className="panel-kicker">Audio</p>
                      <h2>Playback reference</h2>
                    </div>
                  </div>

                  {selectedInterview.audioUrl ? (
                    <audio className="admin-audio" controls preload="auto" src={selectedInterview.audioUrl} />
                  ) : (
                    <div className="empty-state">Audio file not found.</div>
                  )}
                </section>

                <section className="admin-panel metadata-panel">
                  <div className="panel-heading">
                    <div>
                      <p className="panel-kicker">Metadata</p>
                      <h2>Interview details</h2>
                    </div>
                  </div>

                  <dl className="metadata-list">
                    <div>
                      <dt>ID</dt>
                      <dd>{selectedInterview.id}</dd>
                    </div>
                    <div>
                      <dt>Date</dt>
                      <dd>{selectedInterview.date || 'Not listed'}</dd>
                    </div>
                    <div>
                      <dt>Collection</dt>
                      <dd>{selectedInterview.collection || 'Not listed'}</dd>
                    </div>
                    <div>
                      <dt>Sport</dt>
                      <dd>{selectedInterview.sport || 'Not listed'}</dd>
                    </div>
                    <div>
                      <dt>Team</dt>
                      <dd>{selectedInterview.team || 'Not listed'}</dd>
                    </div>
                    <div>
                      <dt>Description</dt>
                      <dd>{selectedInterview.description || 'Not listed'}</dd>
                    </div>
                  </dl>
                </section>
              </section>
            </>
          ) : (
            <section className="admin-panel empty-workbench">
              <h2>No interviews found.</h2>
            </section>
          )}
        </section>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('admin-root') as HTMLElement).render(
  <AdminApp />,
);
