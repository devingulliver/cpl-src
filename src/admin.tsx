import { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { createItem, deleteItem, fetchItems, saveItem, type Item } from './api';
import './admin.css';

function createBlankItem(): Item {
  return {
    id: `record-${Date.now()}`,
    title: '',
    sourceDate: '',
    archiveDate: '',
    author: '',
    description: '',
    collection: '',
    sport: '',
    team: '',
    format: 'Image',
    year: null,
    image: '',
    audio: '',
    transcript: '',
    transcriptUrl: '',
    filesize: null,
  };
}

function AdminApp() {
  const [items, setItems] = useState<Item[]>([]);
  const [filter, setFilter] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [drafts, setDrafts] = useState<Record<string, Item>>({});
  const [newDraft, setNewDraft] = useState<Item | null>(null);
  const [saveMessage, setSaveMessage] = useState('Ready.');

  useEffect(() => {
    void fetchItems()
      .then((loadedItems) => {
        setItems(loadedItems);
        setSelectedId(loadedItems[0]?.id ?? '');
      })
      .catch(() => setSaveMessage('Unable to load catalog records.'));
  }, []);

  const selectedItem = items.find((item) => item.id === selectedId) ?? items[0] ?? null;
  const draft = newDraft ?? (selectedItem ? drafts[selectedItem.id] ?? selectedItem : null);
  const query = filter.trim().toLowerCase();
  const visibleItems = useMemo(() => {
    if (query.length === 0) return items;
    return items.filter((item) => [item.id, item.title, item.collection, item.description, item.format, item.year]
      .join(' ').toLowerCase().includes(query));
  }, [items, query]);
  const dirty = selectedItem && draft ? JSON.stringify(draft) !== JSON.stringify(selectedItem) : false;

  const updateDraft = (field: keyof Item, value: string | number | null) => {
    if (!selectedItem && !newDraft) return;
    const next = { ...(draft ?? selectedItem ?? newDraft), [field]: value } as Item;
    if (newDraft) {
      setNewDraft(next);
    } else {
      setDrafts((current) => ({ ...current, [selectedItem!.id]: next }));
    }
    setSaveMessage('Unsaved record edits.');
  };

  const handleSave = async () => {
    if (!draft) return;
    setSaveMessage('Saving...');
    try {
      if (newDraft) {
        const created = await createItem(draft);
        setItems((current) => [created, ...current]);
        setSelectedId(created.id);
        setNewDraft(null);
      } else {
        await saveItem(draft);
        setItems((current) => current.map((item) => item.id === draft.id ? draft : item));
      }
      setDrafts((current) => {
        const next = { ...current };
        delete next[draft.id];
        return next;
      });
      setSaveMessage(newDraft ? 'New record added to SQL database.' : 'Record saved to SQL database.');
    } catch {
      setSaveMessage('Save failed.');
    }
  };

  const handleDelete = async () => {
    if (!selectedItem || newDraft) return;
    const confirmed = window.confirm(`Delete record "${selectedItem.title || selectedItem.id}"? This cannot be undone.`);
    if (!confirmed) return;

    setSaveMessage('Deleting...');
    try {
      await deleteItem(selectedItem.id);
      const remainingItems = items.filter((item) => item.id !== selectedItem.id);
      setItems(remainingItems);
      setDrafts((current) => {
        const next = { ...current };
        delete next[selectedItem.id];
        return next;
      });
      setSelectedId(remainingItems[0]?.id ?? '');
      setSaveMessage('Record deleted from SQL database.');
    } catch {
      setSaveMessage('Delete failed.');
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <p className="admin-kicker">CPL librarian review panel</p>
          <h1 className="admin-title">Catalog editor</h1>
          <p className="admin-subtitle">Edit metadata, media links, and transcripts for every catalog record.</p>
        </div>
        <div className="admin-status" aria-live="polite">{saveMessage}</div>
      </header>

      <main className="admin-layout">
        <aside className="admin-sidebar">
          <label className="admin-search" htmlFor="admin-search">
            <span>Search catalog</span>
            <input id="admin-search" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder='Try "Barnhart" or "1901"' type="search" />
          </label>
          <button className="new-record-button" onClick={() => { setNewDraft(createBlankItem()); setSelectedId(''); }} type="button">
            Add new record
          </button>
          <div className="interview-list" role="list" aria-label="Catalog records">
            {visibleItems.map((item) => (
              <button key={item.id} className={`interview-card ${item.id === selectedItem?.id && !newDraft ? 'is-active' : ''}`} onClick={() => { setNewDraft(null); setSelectedId(item.id); }} type="button">
                <span className="interview-card-id">{item.id}</span>
                <span className="interview-card-title">{item.title}</span>
                <span className="interview-card-meta">{item.format} · {item.year || 'Undated'}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="admin-workbench">
          {draft ? (
            <>
              <section className="admin-panel transcript-panel-card">
                <div className="panel-heading">
                  <div><p className="panel-kicker">Record editor</p><h2>{draft.title || 'Untitled record'}</h2></div>
                  <div className="panel-note">{dirty ? 'Edited locally' : 'Record loaded'}</div>
                </div>
                <div className="metadata-form">
                  {newDraft ? (
                    <label>ID<input value={draft.id} onChange={(event) => updateDraft('id', event.target.value)} /></label>
                  ) : null}
                  <label>Title<input value={draft.title} onChange={(event) => updateDraft('title', event.target.value)} /></label>
                  <label>Source date<input value={draft.sourceDate} onChange={(event) => updateDraft('sourceDate', event.target.value)} /></label>
                  <label>Archive date<input value={draft.archiveDate} onChange={(event) => updateDraft('archiveDate', event.target.value)} /></label>
                  <label>Author<input value={draft.author} onChange={(event) => updateDraft('author', event.target.value)} /></label>
                  <label>Collection<input value={draft.collection} onChange={(event) => updateDraft('collection', event.target.value)} /></label>
                  <label>Sport<input value={draft.sport} onChange={(event) => updateDraft('sport', event.target.value)} /></label>
                  <label>Team<input value={draft.team} onChange={(event) => updateDraft('team', event.target.value)} /></label>
                  {newDraft ? (
                    <label>Format<select value={draft.format} onChange={(event) => updateDraft('format', event.target.value)}><option value="Image">Image</option><option value="Audio">Audio</option></select></label>
                  ) : null}
                  <label>Year<input type="number" value={draft.year ?? ''} onChange={(event) => updateDraft('year', event.target.value ? Number(event.target.value) : null)} /></label>
                  <label className="metadata-form-wide">Description<textarea value={draft.description} onChange={(event) => updateDraft('description', event.target.value)} /></label>
                  <label className="metadata-form-wide">Image URL<input value={draft.image} onChange={(event) => updateDraft('image', event.target.value)} /></label>
                  <label className="metadata-form-wide">Audio URL<input value={draft.audio} onChange={(event) => updateDraft('audio', event.target.value)} /></label>
                </div>
                {draft.format === 'Audio' ? (
                  <label className="transcript-field">Transcript<textarea aria-label="Transcript editor" className="transcript-editor" onChange={(event) => updateDraft('transcript', event.target.value)} spellCheck={false} value={draft.transcript} /></label>
                ) : null}
                <div className="editor-actions">
                  <button className="save-button" onClick={handleSave} type="button">Save record</button>
                  {!newDraft ? <button className="delete-button" onClick={handleDelete} type="button">Delete record</button> : null}
                </div>
              </section>
              <section className="admin-side-stack">
                {draft.format === 'Audio' && draft.audio ? (
                  <section className="admin-panel media-panel"><div className="panel-heading"><div><p className="panel-kicker">Audio</p><h2>Playback reference</h2></div></div><audio className="admin-audio" controls preload="auto" src={draft.audio} /></section>
                ) : null}
                {draft.format === 'Image' && draft.image ? (
                  <section className="admin-panel media-panel"><div className="panel-heading"><div><p className="panel-kicker">Image</p><h2>Preview</h2></div></div><img className="admin-image-preview" src={draft.image} alt={draft.title} /></section>
                ) : null}
                <section className="admin-panel metadata-panel">
                  <div className="panel-heading"><div><p className="panel-kicker">Record</p><h2>Details</h2></div></div>
                  <dl className="metadata-list"><div><dt>ID</dt><dd>{draft.id}</dd></div><div><dt>Format</dt><dd>{draft.format}</dd></div><div><dt>Filesize</dt><dd>{draft.filesize ? `${draft.filesize.toLocaleString()} bytes` : 'Not listed'}</dd></div></dl>
                </section>
              </section>
            </>
          ) : <section className="admin-panel empty-workbench"><h2>No catalog records found.</h2></section>}
        </section>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('admin-root') as HTMLElement).render(<AdminApp />);
