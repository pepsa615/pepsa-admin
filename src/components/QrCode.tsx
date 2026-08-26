import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export function QrCode({ value, label }: { value: string; label: string }) {
  const [source, setSource] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setSource('');
    setFailed(false);
    void QRCode.toDataURL(value, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 220,
      color: { dark: '#111613', light: '#ffffff' },
    })
      .then((result) => {
        if (active) setSource(result);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [value]);

  if (failed) return <span className="qr-code-fallback">Use the setup key below.</span>;
  if (!source) return <span className="qr-code-loading">Generating QR code…</span>;
  return <img className="qr-code" src={source} alt={label} />;
}
