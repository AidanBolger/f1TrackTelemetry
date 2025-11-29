import React, { useMemo } from 'react'
import { MapContainer, Marker, useMap, CircleMarker, GeoJSON, Tooltip, Polyline } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
// load precomputed transform (written by scripts/compute_transform.js)
import cornerTransform from '../data/corner_transform.json'
// telemetry (driver lap) file
import telJson from '../25_tel.json'
import './TrackMap.css'

// default padding used for fitBounds (tight)
const DEFAULT_PADDING: [number, number] = [10, 10]

type Corners = {
  CornerNumber: number[]
  X: number[]
  Y: number[]
  Angle?: number[]
  Distance?: number[]
  Rotation?: number[]
}

type DisplayCorner = { lat: number; lon: number; idx: number; num?: number }

// FitBounds removed — we now use FitBoundsGeo for the geographic GeoJSON view.

function FitBoundsGeo({ coords }: { coords: [number, number][] }) {
  const map = useMap()
  React.useEffect(() => {
    if (!coords || coords.length === 0) return
    const latlngs = coords.map(c => L.latLng(c[1], c[0]))
    const bounds = L.latLngBounds(latlngs as any)
    setTimeout(() => map.invalidateSize(), 0)
    // Use tight padding so the track fills more of the viewport by default
    map.fitBounds(bounds, { padding: DEFAULT_PADDING })
  }, [map, coords])
  return null
}

export default function TrackMap({ corners, highResGeo }: { corners: Corners | null, highResGeo?: any }) {
  const mapRef = React.useRef<any | null>(null)
  const cornerPoints = useMemo(() => {
    if (!corners) return [] as { x: number; y: number; idx: number; num?: number }[]
    const { X, Y, CornerNumber } = corners
    const out: { x: number; y: number; idx: number; num?: number }[] = []
    for (let i = 0; i < Math.min(X.length, Y.length); i++) {
      out.push({ x: X[i], y: Y[i], idx: i, num: CornerNumber?.[i] })
    }
    return out
  }, [corners])

  // debug info about corners bbox
  React.useEffect(() => {
    if (!cornerPoints.length) return
    const xs = cornerPoints.map(p => p.x)
    const ys = cornerPoints.map(p => p.y)
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minY = Math.min(...ys), maxY = Math.max(...ys)
    console.log('TrackMap debug: corners', cornerPoints.length, 'X range', minX, maxX, 'Y range', minY, maxY)
  }, [cornerPoints])

  // We'll render a single geographic map (WGS84) using the high-res GeoJSON.
  // The corners coordinates are in the project's planar XY space. To overlay them on the geographic GeoJSON
  // we do a best-effort linear mapping from the corners bounding box to the GeoJSON bbox (affine scale+translate).
  // This is a heuristic — if you want a precise georeference we can compute an affine/helmert transform from control points.
  const mappedCorners = useMemo(() => {
    if (!highResGeo || !highResGeo.features || !highResGeo.features.length) return [] as { lat: number; lon: number; idx: number; num?: number }[]
    if (!cornerPoints.length) return [] as { lat: number; lon: number; idx: number; num?: number }[]

    // GeoJSON bbox (compute from the first feature coordinates)
    const coords: [number, number][] = highResGeo.features[0].geometry.coordinates
    const lons = coords.map(c => c[0])
    const lats = coords.map(c => c[1])
    const minLon = Math.min(...lons), maxLon = Math.max(...lons)
    const minLat = Math.min(...lats), maxLat = Math.max(...lats)

    // corners bbox
    const xs = cornerPoints.map(p => p.x)
    const ys = cornerPoints.map(p => p.y)
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minY = Math.min(...ys), maxY = Math.max(...ys)

    // Map x->lon and y->lat linearly. Note: if the Y axis orientation differs, this simple linear mapping may flip the track vertically.
    const mapXtoLon = (x: number) => {
      if (maxX === minX) return (minLon + maxLon) / 2
      return ((x - minX) / (maxX - minX)) * (maxLon - minLon) + minLon
    }
    const mapYtoLat = (y: number) => {
      if (maxY === minY) return (minLat + maxLat) / 2
      return ((y - minY) / (maxY - minY)) * (maxLat - minLat) + minLat
    }

    return cornerPoints.map(c => ({ lat: mapYtoLat(c.y), lon: mapXtoLon(c.x), idx: c.idx, num: c.num }))
  }, [highResGeo, cornerPoints])

  // (ICP removed) We rely on a precomputed transform for display; mappedCorners remains as a simple bbox fallback.

    // If a precomputed transform exists (written by scripts/compute_transform.js), use it to map corners
    const precomputedMappedCorners = useMemo(() => {
      try {
        const t = (cornerTransform && (cornerTransform as any).transform) ? (cornerTransform as any).transform : null
        if (!t) return [] as { lon: number; lat: number; idx: number; num?: number }[]
        const s = t.s, cos = t.cos, sin = t.sin, tx = t.tx, ty = t.ty
        return cornerPoints.map(cp => {
          const x = cp.x, y = cp.y
          const px = s * (cos * x - sin * y) + tx
          const py = s * (sin * x + cos * y) + ty
          const latlng = L.CRS.EPSG3857.unproject(L.point(px, py))
          return { lon: latlng.lng, lat: latlng.lat, idx: cp.idx, num: cp.num }
        })
      } catch (e) {
        // fallback: empty so UI uses refinedMappedCorners
        return [] as { lon: number; lat: number; idx: number; num?: number }[]
      }
    }, [cornerPoints])

    // choose display positions: prefer precomputed transform, else fall back to bbox linear mapping
    const displayCorners = useMemo<DisplayCorner[]>(() => {
      if (precomputedMappedCorners && precomputedMappedCorners.length) return precomputedMappedCorners as DisplayCorner[]
      return mappedCorners as DisplayCorner[]
    }, [precomputedMappedCorners, mappedCorners])

    // --- Telemetry: load telemetry JSON (driver lap) and map to lat/lon using same precomputed transform ---
    const telemetry = telJson && telJson.tel ? telJson.tel : null

    const telemetryLatLngs = useMemo(() => {
      if (!telemetry || !telemetry.x || !telemetry.y) return [] as [number, number][]
      const xs: number[] = telemetry.x
      const ys: number[] = telemetry.y
      // prefer using precomputed transform if available
      const t = (cornerTransform && (cornerTransform as any).transform) ? (cornerTransform as any).transform : null
      if (t) {
        const s = t.s, cos = t.cos, sin = t.sin, tx = t.tx, ty = t.ty
        return xs.map((x, i) => {
          const y = ys[i]
          const px = s * (cos * x - sin * y) + tx
          const py = s * (sin * x + cos * y) + ty
          const latlng = L.CRS.EPSG3857.unproject(L.point(px, py))
          return [latlng.lat, latlng.lng] as [number, number]
        })
      }
      // fallback: try simple bbox mapping into highResGeo (if present)
      if (highResGeo && highResGeo.features && highResGeo.features[0]) {
        const coords: [number, number][] = highResGeo.features[0].geometry.coordinates
        const lons = coords.map(c => c[0])
        const lats = coords.map(c => c[1])
        const minLon = Math.min(...lons), maxLon = Math.max(...lons)
        const minLat = Math.min(...lats), maxLat = Math.max(...lats)
        const minX = Math.min(...xs), maxX = Math.max(...xs)
        const minY = Math.min(...ys), maxY = Math.max(...ys)
        const mapXtoLon = (x: number) => (maxX === minX) ? (minLon + maxLon) / 2 : ((x - minX) / (maxX - minX)) * (maxLon - minLon) + minLon
        const mapYtoLat = (y: number) => (maxY === minY) ? (minLat + maxLat) / 2 : ((y - minY) / (maxY - minY)) * (maxLat - minLat) + minLat
        return xs.map((x, i) => ([mapYtoLat(ys[i]), mapXtoLon(x)] as [number, number]))
      }
      return [] as [number, number][]
    }, [telemetry, highResGeo])

    // playback state
    const [currentIndex, setCurrentIndex] = React.useState(0)
    const [playing, setPlaying] = React.useState(false)
    const [speed, setSpeed] = React.useState(1) // 1x

    // helper: binary search for time -> index
    const findIndexByTime = React.useCallback((tgt: number) => {
      if (!telemetry || !telemetry.time) return 0
      const arr: number[] = telemetry.time
      let lo = 0, hi = arr.length - 1
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2)
        if (arr[mid] < tgt) lo = mid + 1
        else hi = mid - 1
      }
      return Math.max(0, Math.min(arr.length - 1, lo))
    }, [telemetry])

    // playback effect: when playing, update currentIndex based on wall clock and telemetry time
    React.useEffect(() => {
      if (!playing || !telemetry || !telemetry.time) return
      let rafId: number | null = null
      let startWall = performance.now()
      const startIndex = currentIndex
      const startTelTime = telemetry.time[startIndex] || 0

      const step = () => {
        const elapsedMs = performance.now() - startWall
        const elapsedSec = (elapsedMs / 1000) * speed
        const targetTime = startTelTime + elapsedSec
        const idx = findIndexByTime(targetTime)
        setCurrentIndex(idx)
        rafId = requestAnimationFrame(step)
      }
      rafId = requestAnimationFrame(step)
      return () => { if (rafId) cancelAnimationFrame(rafId) }
    }, [playing, telemetry, speed, findIndexByTime])

    // helper to round displayed telemetry values to whole numbers
    const roundDisplay = (v: any) => {
      if (v === null || v === undefined) return '-'
      if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v)
      const n = Number(v)
      return Number.isFinite(n) ? Math.round(n) : v
    }

    // format a telemetry value as percent (0-100). Accepts 0..1 or 0..100 inputs.
    const formatPercent = (v: any): number | null => {
      if (v === null || v === undefined) return null
      const n = Number(v)
      if (!Number.isFinite(n)) return null
      let p = n
      if (p >= 0 && p <= 1) p = p * 100
      // clamp
      if (p < 0) p = 0
      if (p > 100) p = 100
      return Math.round(p)
    }

    // format distance (assumed meters) to kilometers with two decimals (e.g., 1.23 km)
    const formatKm = (v: any): string => {
      if (v === null || v === undefined) return '-'
      const n = Number(v)
      if (!Number.isFinite(n)) return '-'
      const km = n / 1000
      return (Math.round(km * 100) / 100).toFixed(2) + ' km'
    }

    // format time in seconds with three decimal places
    const formatTime = (v: any): string => {
      if (v === null || v === undefined) return '-'
      const n = Number(v)
      if (!Number.isFinite(n)) return '-'
      return n.toFixed(3) + 's'
    }


  return (
    <div className="tm-container">
      {/* Left column: map */}
      <div className="tm-left">
        {!highResGeo || !highResGeo.features || !highResGeo.features.length ? (
          <div style={{ padding: 20 }}>No high-resolution GeoJSON track provided.</div>
        ) : (
          <MapContainer
            ref={(m: any) => { mapRef.current = m }}
            center={[highResGeo.features[0].geometry.coordinates[0][1], highResGeo.features[0].geometry.coordinates[0][0]]}
            zoom={14}
            className="tm-map"
          >
            <FitBoundsGeo coords={highResGeo.features[0].geometry.coordinates as [number, number][]} />
            <GeoJSON data={highResGeo} style={{ color: '#2b7ae4', weight: 4, opacity: 0.95 }} />

            {/* telemetry polyline */}
            {telemetryLatLngs && telemetryLatLngs.length > 0 && (
              <Polyline positions={telemetryLatLngs.map(p => [p[0], p[1]])} pathOptions={{ color: '#ffb400', weight: 3, opacity: 0.9 }} />
            )}

            {/* playback marker */}
            {telemetryLatLngs && telemetryLatLngs.length > 0 && telemetryLatLngs[currentIndex] && (
              <Marker position={telemetryLatLngs[currentIndex] as any} />
            )}

            {/* plotted corner circles (precomputed transform, or bbox fallback) */}
            {displayCorners.map((c, i) => (
              <CircleMarker key={i} center={[c.lat, c.lon]} radius={6} pathOptions={{ color: '#d33', fillColor: '#d33' }}>
                <Tooltip>{c.num ?? `#${c.idx}`}</Tooltip>
              </CircleMarker>
            ))}

          </MapContainer>
        )}
      </div>

      {/* Right column: controls / info */}
      <div className="tm-controls">
        <div className="tm-controls-title">Track Controls</div>
        <div className="tm-controls-desc">Use this panel for playback controls, toggles, or telemetry info.</div>

        {/* Telemetry controls */}
        {telemetry && telemetry.time && (
          <div style={{ marginTop: 6 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <button onClick={() => setPlaying(p => !p)} className="tm-play-button">{playing ? 'Pause' : 'Play'}</button>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <label style={{ fontSize: 12 }}>Speed</label>
                <select value={speed} onChange={e => setSpeed(Number(e.target.value))}>
                  <option value={0.25}>0.25x</option>
                  <option value={0.5}>0.5x</option>
                  <option value={1}>1x</option>
                  <option value={2}>2x</option>
                  <option value={4}>4x</option>
                </select>
              </div>
            </div>

            <input
              type="range"
              min={0}
              max={Math.max(0, telemetry.time.length - 1)}
              value={currentIndex}
              onChange={e => { setCurrentIndex(Number(e.target.value)); setPlaying(false) }}
              className="tm-range"
            />

            <div style={{ fontSize: 12, marginTop: 6 }}>
              Time: {(telemetry.time[currentIndex] ?? 0).toFixed(3)}s — Index: {currentIndex}
            </div>
          </div>
        )}

        <div style={{ marginTop: 10 }}>
          <button
            onClick={() => {
              // Refit using the tight default padding
              try {
                if (!mapRef.current || !highResGeo || !highResGeo.features || !highResGeo.features.length) return
                const coords: [number, number][] = highResGeo.features[0].geometry.coordinates
                const latlngs = coords.map(c => L.latLng(c[1], c[0]))
                const bounds = L.latLngBounds(latlngs as any)
                setTimeout(() => mapRef.current.invalidateSize(), 0)
                mapRef.current.fitBounds(bounds, { padding: DEFAULT_PADDING })
              } catch (e) {}
            }}
            title="Refit map (tight padding)"
            className="tm-button-primary"
          >
            Refit Map
          </button>
        </div>

        {/* Telemetry metrics as individual cards */}
        {telemetry && (
          <div className="tm-telemetry-wrap">
            <div className="tm-metrics-row">
              <div className="tm-metric-card">
                <div className="tm-metric-label">Time</div>
                <div className="tm-metric-value">{formatTime(telemetry.time?.[currentIndex] ?? 0)}</div>
              </div>

              <div className="tm-metric-card">
                <div className="tm-metric-label">Speed</div>
                <div className="tm-metric-value">{String(roundDisplay(telemetry.speed?.[currentIndex]))} km/h</div>
              </div>

              <div className="tm-metric-card">
                <div className="tm-metric-label">RPM</div>
                <div className="tm-metric-value">{String(roundDisplay(telemetry.rpm?.[currentIndex]))}</div>
              </div>

              <div className="tm-metric-card">
                <div className="tm-metric-label">Gear</div>
                <div className="tm-metric-value">{String(roundDisplay(telemetry.gear?.[currentIndex]))}</div>
              </div>

              <div className="tm-metric-card">
                <div className="tm-metric-label">Throttle</div>
                <div>
                  {(() => {
                    const pct = formatPercent(telemetry.throttle?.[currentIndex])
                    return (
                      <div className="tm-bar" title={pct !== null ? `${pct}%` : 'n/a'}>
                        <div className="tm-bar-fill-throttle" style={{ width: pct !== null ? `${pct}%` : '0%' }} />
                        {pct !== null && <div className="tm-bar-label">{pct}%</div>}
                      </div>
                    )
                  })()}
                </div>
              </div>

              <div className="tm-metric-card">
                <div className="tm-metric-label">Brake</div>
                <div>
                  {(() => {
                    const pct = formatPercent(telemetry.brake?.[currentIndex])
                    return (
                      <div className="tm-bar" title={pct !== null ? `${pct}%` : 'n/a'}>
                        <div className="tm-bar-fill-brake" style={{ width: pct !== null ? `${pct}%` : '0%' }} />
                        {pct !== null && <div className="tm-bar-label">{pct}%</div>}
                      </div>
                    )
                  })()}
                </div>
              </div>

              <div className="tm-metric-card">
                <div className="tm-metric-label">Distance</div>
                <div className="tm-metric-value">{formatKm(telemetry.distance?.[currentIndex])}</div>
              </div>
            </div>

            
            <div className="tm-metric-label">Position (X, Y)</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#3a17ffab" }}>{String(roundDisplay(telemetry.x?.[currentIndex]))}, {String(roundDisplay(telemetry.y?.[currentIndex]))}</div>
            
          </div>
        )}
      </div>
    </div>
  )
}
