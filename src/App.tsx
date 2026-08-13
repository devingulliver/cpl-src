import { Suspense, lazy, useEffect, useMemo, useRef, useState, type Dispatch, type KeyboardEvent, type SetStateAction } from 'react';
import csvText from './data.csv?raw';
import interviewCsvText from '../interviews/data.csv?raw';

const transcriptAssetMap = import.meta.glob('../interviews/*.srt', {
  eager: true,
  query: '?raw',
  import: 'default',
});

const MiradorViewer = lazy(async () => {
  const module = await import('./MiradorViewer');
  return { default: module.MiradorViewer };
});

const AudioViewer = lazy(async () => {
  const module = await import('./AudioViewer');
  return { default: module.AudioViewer };
});

type Item = {
  id: string;
  title: string;
  sourceDate: string;
  archiveDate: string;
  author: string;
  description: string;
  collection: string;
  sport: string;
  team: string;
  format: string;
  year: number | null;
  image: string;
  audio: string;
  transcript: string;
  filesize: number | null;
};

function getInterviewAsset(map: Record<string, unknown>, id: string, extension: string) {
  const path = `../interviews/${id}${extension}`;
  const value = map[path];

  return typeof value === 'string' ? value : '';
}

function buildInterviewAudioUrl(id: string) {
  const match = id.match(/_(\d+)$/);
  const numericId = match ? match[1] : id;

  return `https://cplorg.contentdm.oclc.org/digital/api/collection/p4014coll27/id/${numericId}/download`;
}

function parseByteSize(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number(value.trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

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

function extractYear(...values: string[]): number | null {
  for (const value of values) {
    const match = value.match(/\b(1[89]\d{2}|20\d{2})\b/);

    if (match) {
      return Number(match[1]);
    }
  }

  return null;
}

function parseItems(text: string): Item[] {
  const rows = parseCsv(text);

  return rows.slice(1).map((row, index) => {
    const rawId = row[0] ?? index + 1;
    const id = String(rawId);
    const title = row[1] ?? '';
    const sourceDate = row[2] ?? '';
    const archiveDate = row[3] ?? '';
    const collection = row[6] ?? 'Uncategorized';
    const year = extractYear(sourceDate, archiveDate, title);

    return {
      id,
      title,
      sourceDate,
      archiveDate,
      author: row[4] ?? '',
      description: row[5] ?? '',
      collection,
      sport: row[7] ?? 'Baseball',
      team: row[8] ?? '',
      format: 'Image',
      year,
      image: row[9] ?? row[7] ?? '',
      audio: '',
      transcript: '',
      filesize: null,
    };
  });
}

function parseInterviewItems(text: string): Item[] {
  const rows = parseCsv(text);

  return rows.slice(1).map((row, index) => {
    const rawId = row[0] ?? index + 1;
    const id = String(rawId);
    const title = row[1] ?? '';
    const sourceDate = row[2] ?? '';
    const archiveDate = row[2] ?? '';
    const year = extractYear(sourceDate, row[3] ?? '', title);
    const audio = buildInterviewAudioUrl(id);
    const transcript = getInterviewAsset(transcriptAssetMap, id, '.srt');
    const filesize = parseByteSize(row[9]);

    return {
      id,
      title,
      sourceDate,
      archiveDate,
      author: row[4] ?? '',
      description: row[5] ?? '',
      collection: row[6] ?? 'Uncategorized',
      sport: row[7] ?? 'Baseball',
      team: '',
      format: 'Audio',
      year,
      image: '',
      audio,
      transcript,
      filesize,
    };
  });
}

const initialItems = [...parseItems(csvText), ...parseInterviewItems(interviewCsvText)];

const collections = Array.from(new Set(initialItems.map((item) => item.collection).filter(Boolean))).sort();
const sports = Array.from(new Set(initialItems.map((item) => item.sport).filter(Boolean))).sort();
const teams = Array.from(new Set(initialItems.map((item) => item.team).filter(Boolean))).sort();
const formats = Array.from(new Set(initialItems.map((item) => item.format).filter(Boolean))).sort();

const years = initialItems.flatMap((item) => (item.year === null ? [] : [item.year]));
const YEAR_MIN = years.length > 0 ? Math.min(...years) : 1870;
const YEAR_MAX = years.length > 0 ? Math.max(...years) : 2021;

const initialCollections = new Set<string>();
const initialSports = new Set<string>();
const initialTeams = new Set<string>();
const initialFormats = new Set<string>();

type YearRangeSliderProps = {
  min: number;
  max: number;
  onChangeMin: (value: number) => void;
  onChangeMax: (value: number) => void;
};

function YearRangeSlider({ min, max, onChangeMin, onChangeMax }: YearRangeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const activeThumbRef = useRef<'min' | 'max' | null>(null);

  const setFromPointer = (clientX: number) => {
    const track = trackRef.current;
    if (!track) {
      return;
    }

    const bounds = track.getBoundingClientRect();
    const percent = Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width));
    const rawValue = Math.round(YEAR_MIN + percent * (YEAR_MAX - YEAR_MIN));

    if (activeThumbRef.current === 'min') {
      onChangeMin(Math.min(rawValue, max));
    } else if (activeThumbRef.current === 'max') {
      onChangeMax(Math.max(rawValue, min));
    }
  };

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!activeThumbRef.current) {
        return;
      }

      setFromPointer(event.clientX);
    };

    const handlePointerUp = () => {
      activeThumbRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [max, min]);

  const minPercent = ((min - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * 100;
  const maxPercent = ((max - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * 100;

  const handleKeyDown = (thumb: 'min' | 'max') => (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = event.shiftKey ? 10 : 1;

    if (thumb === 'min') {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
        event.preventDefault();
        onChangeMin(Math.max(YEAR_MIN, min - step));
      }

      if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
        event.preventDefault();
        onChangeMin(Math.min(max, min + step));
      }
    }

    if (thumb === 'max') {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
        event.preventDefault();
        onChangeMax(Math.max(min, max - step));
      }

      if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
        event.preventDefault();
        onChangeMax(Math.min(YEAR_MAX, max + step));
      }
    }
  };

  return (
    <div className="range-shell">
      <div
        ref={trackRef}
        className="range-track"
        onPointerDown={(event) => {
          const bounds = trackRef.current?.getBoundingClientRect();
          if (!bounds) {
            return;
          }

          activeThumbRef.current =
            Math.abs(event.clientX - (bounds.left + (bounds.width * minPercent) / 100)) <=
            Math.abs(event.clientX - (bounds.left + (bounds.width * maxPercent) / 100))
              ? 'min'
              : 'max';
          setFromPointer(event.clientX);
        }}
      >
        <div className="range-fill" style={{ left: `${minPercent}%`, right: `${100 - maxPercent}%` }} />
        <button
          aria-label="Minimum year"
          className="range-thumb"
          onKeyDown={handleKeyDown('min')}
          onPointerDown={() => {
            activeThumbRef.current = 'min';
          }}
          style={{ left: `${minPercent}%` }}
          type="button"
        />
        <button
          aria-label="Maximum year"
          className="range-thumb"
          onKeyDown={handleKeyDown('max')}
          onPointerDown={() => {
            activeThumbRef.current = 'max';
          }}
          style={{ left: `${maxPercent}%` }}
          type="button"
        />
      </div>
    </div>
  );
}

function FormatIcon({ format }: { format: string }) {
  if (format === 'Audio') {
    return (
      <svg aria-hidden="true" className="format-icon" viewBox="0 0 48 48">
        <path d="M18 29h-4a3 3 0 0 1-3-3v-4a3 3 0 0 1 3-3h4l8-7v24l-8-7Z" />
        <path d="M31 18a8 8 0 0 1 0 12" />
        <path d="M35 14a14 14 0 0 1 0 20" />
      </svg>
    );
  }

  if (format === 'Document') {
    return (
      <svg aria-hidden="true" className="format-icon" viewBox="0 0 48 48">
        <path d="M15 10h13l7 7v21H15V10Z" />
        <path d="M28 10v8h8" />
        <path d="M18 22h12" />
        <path d="M18 28h12" />
        <path d="M18 34h8" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="format-icon" viewBox="0 0 48 48">
      <rect x="11" y="12" width="26" height="24" rx="2" />
      <path d="M16 29l6-6 5 5 4-4 6 7" />
      <circle cx="20" cy="20" r="2.5" />
    </svg>
  );
}

function detailValue(value: string | number | null) {
  if (value === null) {
    return 'Not listed';
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : 'Not listed';
}

function FooterNote() {
  return (
    <footer className="footer-note">
      Cleveland Public Library neither grants nor denies permission to publish photographs or images from its
      collection, including those in the Digital Gallery. Unless otherwise stated, the Library believes that the
      images in the Digital Gallery are in the Public Domain, and the Library makes no warranty concerning their
      copyright status. The Library asks that an image be cited to Cleveland Public Library as the source of the
      image.
    </footer>
  );
}

function App() {
  const [query, setQuery] = useState('');
  const [catalogItems, setCatalogItems] = useState<Item[]>(() => initialItems);
  const [selectedCollections, setSelectedCollections] = useState<Set<string>>(initialCollections);
  const [selectedSports, setSelectedSports] = useState<Set<string>>(initialSports);
  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(initialTeams);
  const [selectedFormats, setSelectedFormats] = useState<Set<string>>(initialFormats);
  const [yearMin, setYearMin] = useState(YEAR_MIN);
  const [yearMax, setYearMax] = useState(YEAR_MAX);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    const term = query.trim().toLowerCase();
    const yearFilterIsDefault = yearMin === YEAR_MIN && yearMax === YEAR_MAX;

    return catalogItems.filter((item) => {
      const matchesTerm =
        term.length === 0 ||
        item.title.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term) ||
        item.collection.toLowerCase().includes(term) ||
        item.sport.toLowerCase().includes(term) ||
        item.team.toLowerCase().includes(term) ||
        item.transcript.toLowerCase().includes(term);
      const matchesCollection = selectedCollections.size === 0 || selectedCollections.has(item.collection);
      const matchesSport = selectedSports.size === 0 || selectedSports.has(item.sport);
      const matchesTeam = selectedTeams.size === 0 || selectedTeams.has(item.team);
      const matchesFormat = selectedFormats.size === 0 || selectedFormats.has(item.format);
      const matchesYear =
        item.year === null ? yearFilterIsDefault : item.year >= yearMin && item.year <= yearMax;

      return matchesTerm && matchesCollection && matchesSport && matchesTeam && matchesFormat && matchesYear;
    });
  }, [catalogItems, query, selectedCollections, selectedSports, selectedTeams, selectedFormats, yearMin, yearMax]);

  const toggleSelection = (value: string, setSelection: Dispatch<SetStateAction<Set<string>>>) => {
    setSelection((current) => {
      const next = new Set(current);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  };

  const selectedItem = selectedItemId === null ? null : catalogItems.find((item) => item.id === selectedItemId) ?? null;
  const detailFields = selectedItem
    ? [
        ['Author', selectedItem.author],
        ['Collection', selectedItem.collection],
        ['Sport', selectedItem.sport],
        ['Team', selectedItem.team],
        ['Format', selectedItem.format],
        ['Source date', selectedItem.sourceDate],
        ['Archive date', selectedItem.archiveDate],
        ['Publication year', selectedItem.year],
      ]
    : [];
  const backLabel = query.trim().length > 0 ? `← Back to "${query.trim()}"` : '← Back to search';
  const viewer =
    selectedItem && selectedItem.format === 'Audio' ? (
      <Suspense fallback={<div className="viewer-frame viewer-loading">Loading audio viewer…</div>}>
        <AudioViewer
          audioUrl={selectedItem.audio}
          expectedSize={selectedItem.filesize}
          transcriptText={selectedItem.transcript}
          title={selectedItem.title}
        />
      </Suspense>
    ) : selectedItem ? (
      <Suspense fallback={<div className="viewer-frame viewer-loading">Loading Mirador…</div>}>
        <MiradorViewer
          manifestId={`https://cplorg.contentdm.oclc.org//digital/iiif-info/p4014coll27/${selectedItem.id}/manifest.json`}
          title={selectedItem.title}
        />
      </Suspense>
    ) : null;

  const header = (
    <header className="page-header" role="banner">
      <h1 className="page-title">CPL Sports Research Collections</h1>
    </header>
  );

  if (selectedItem) {
    return (
      <div className="page-shell detail-shell">
        {header}

        <main className="app-frame detail-view">
          <aside className="sidebar detail-sidebar">
            <button className="back-link" onClick={() => setSelectedItemId(null)} type="button">
              {backLabel}
            </button>

            <h2 className="detail-title">{selectedItem.title}</h2>

            <p className="detail-description">{selectedItem.description}</p>

            <ul className="detail-metadata" aria-label="Item metadata">
                {detailFields.map(([label, value]) => (
                  <li key={label}>
                    <span>{label}: </span>
                    <span>{detailValue(value)}</span>
                  </li>
                ))}
            </ul>

            <section className="related-section" aria-label="Related items">
              <h3>Related Items</h3>
              <div className="related-items-placeholder" />
            </section>

            {selectedItem.format === 'Audio' ? (
              <>
                <a className="download-link" href={selectedItem.audio} download>
                  Download audio file
                </a>
                {selectedItem.transcript ? (
                  <a className="download-link" href={selectedItem.transcript} download>
                    Download transcript
                  </a>
                ) : null}
              </>
            ) : (
              <a className="download-link" href={selectedItem.image} download>
                Download item image
              </a>
            )}
          </aside>

          <section className="content-area detail-content" aria-label="Viewer">
            {viewer}
          </section>
        </main>

        <FooterNote />
      </div>
    );
  }

  return (
    <div className="page-shell">
        {header}

      <main className="app-frame">
        <aside className="sidebar">
          <label className="search-box" htmlFor="search">
            <input
              id="search"
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder='Try "lefty gomez interview"'
              type="search"
            />
            <span aria-hidden="true">⌕</span>
          </label>

          <button
            aria-controls="mobile-filter-panel"
            aria-expanded={filtersOpen}
            className="filter-toggle"
            onClick={() => setFiltersOpen((current) => !current)}
            type="button"
          >
            <span>Filters</span>
            <span aria-hidden="true" className="filter-toggle-icon">
              {filtersOpen ? '−' : '+'}
            </span>
          </button>

          <div className={`filter-panel ${filtersOpen ? 'is-open' : ''}`} id="mobile-filter-panel">
            <section className="filter-group">
              <h2>Collection</h2>
              <div className="filter-list">
                {collections.map((collection) => (
                  <label key={collection} className="filter-option">
                    <input
                      checked={selectedCollections.has(collection)}
                      onChange={() => toggleSelection(collection, setSelectedCollections)}
                      type="checkbox"
                    />
                    <span>{collection}</span>
                  </label>
                ))}
              </div>
            </section>

            <section className="filter-group">
              <h2>Sport</h2>
              <div className="filter-list">
                {sports.map((sport) => (
                  <label key={sport} className="filter-option">
                    <input
                      checked={selectedSports.has(sport)}
                      onChange={() => toggleSelection(sport, setSelectedSports)}
                      type="checkbox"
                    />
                    <span>{sport}</span>
                  </label>
                ))}
              </div>
            </section>

            <section className="filter-group">
              <h2>Team</h2>
              <div className="filter-list">
                {teams.map((team) => (
                  <label key={team} className="filter-option">
                    <input
                      checked={selectedTeams.has(team)}
                      onChange={() => toggleSelection(team, setSelectedTeams)}
                      type="checkbox"
                    />
                    <span>{team}</span>
                  </label>
                ))}
              </div>
            </section>

            <section className="filter-group">
              <h2>Format</h2>
              <div className="filter-list">
                {formats.map((format) => (
                  <label key={format} className="filter-option">
                    <input
                      checked={selectedFormats.has(format)}
                      onChange={() => toggleSelection(format, setSelectedFormats)}
                      type="checkbox"
                    />
                    <span>{format}</span>
                  </label>
                ))}
              </div>
            </section>

            <section className="filter-group">
              <h2>Publication Year</h2>
              <div className="year-range-labels">
                <span>{yearMin}</span>
                <span>{yearMax}</span>
              </div>
              <YearRangeSlider min={yearMin} max={yearMax} onChangeMax={setYearMax} onChangeMin={setYearMin} />
            </section>
          </div>
        </aside>

        <section className="content-area" aria-label="Results">
          <div className="results-grid">
            {filteredItems.map((item) => (
                <button key={item.id} className="card card-button" onClick={() => setSelectedItemId(item.id)} type="button">
                <div className={`card-media ${item.format === 'Audio' ? 'card-media-audio' : ''}`}>
                  {item.image ? (
                    <img alt={item.title} className="card-image" loading="lazy" src={item.image} />
                  ) : (
                    <FormatIcon format={item.format} />
                  )}
                </div>
                <div className="card-meta">{item.year ?? 'Year not listed'}</div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </button>
            ))}
          </div>
        </section>
      </main>

      <FooterNote />
    </div>
  );
}

export default App;
