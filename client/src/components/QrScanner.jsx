import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff } from 'lucide-react';

/**
 * Camera QR scanner. The camera reports the same code many times per second,
 * so identical reads within a short window are ignored, and reads are paused
 * while the parent is still handling the previous one.
 */
export function QrScanner({ onScan, paused }) {
  const regionId = `qr-${useId().replace(/:/g, '')}`;
  const scannerRef = useRef(null);
  const lastRef = useRef({ code: null, at: 0 });
  const pausedRef = useRef(paused);
  const onScanRef = useRef(onScan);
  useLayoutEffect(() => {
    pausedRef.current = paused;
    onScanRef.current = onScan;
  });
  const [active, setActive] = useState(false);
  const [error, setError] = useState(null);

  const stop = async () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    setActive(false);
    if (s) {
      try { await s.stop(); s.clear(); } catch { /* already stopped */ }
    }
  };

  const start = async () => {
    setError(null);
    const scanner = new Html5Qrcode(regionId, { verbose: false });
    scannerRef.current = scanner;
    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (text) => {
          const now = Date.now();
          if (pausedRef.current) return;
          if (text === lastRef.current.code && now - lastRef.current.at < 3000) return;
          lastRef.current = { code: text, at: now };
          onScanRef.current(text);
        },
        () => {},
      );
      setActive(true);
    } catch (err) {
      scannerRef.current = null;
      const msg = String(err?.message ?? err);
      setError(/permission|NotAllowed/i.test(msg)
        ? 'Camera access was blocked. Allow camera permission in your browser, or enter codes manually below.'
        : 'No camera available on this device. Enter ticket codes manually below.');
    }
  };

  useEffect(() => () => { stop(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div id={regionId} className={`mx-auto w-full max-w-sm overflow-hidden rounded-xl bg-slate-900 ${active ? '' : 'hidden'}`} />
      {!active && (
        <div className="flex aspect-square w-full max-w-sm flex-col items-center justify-center rounded-xl bg-slate-100 mx-auto text-slate-500">
          <Camera className="h-10 w-10" aria-hidden />
          <p className="mt-2 text-sm">Camera is off</p>
        </div>
      )}
      <div className="mt-3 flex justify-center">
        {active ? (
          <button type="button" className="btn-secondary" onClick={stop}><CameraOff className="h-4 w-4" aria-hidden /> Stop camera</button>
        ) : (
          <button type="button" className="btn-primary" onClick={start}><Camera className="h-4 w-4" aria-hidden /> Start camera</button>
        )}
      </div>
      {error && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800" role="alert">{error}</p>}
    </div>
  );
}
